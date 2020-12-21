import { PluginFunction, PluginValidateFn, Types } from "@graphql-codegen/plugin-helpers";
import { DocumentMode } from "@graphql-codegen/visitor-plugin-common";
import { filterJoin, logger, nonNullable } from "@linear/common";
import { concatAST, GraphQLSchema } from "graphql";
import { extname } from "path";
import { RawSdkPluginConfig } from "./config";
import c from "./constants";
import { getChainKeys, getChildDocuments, getRootDocuments, processSdkDocuments } from "./documents";
import { getFragmentsFromAst } from "./fragments";
import { printRequesterType } from "./requester";
import { createVisitor, SdkVisitor } from "./sdk-visitor";

/**
 * Graphql-codegen plugin for outputting the typed Linear sdk
 */
export const plugin: PluginFunction<RawSdkPluginConfig> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: RawSdkPluginConfig
) => {
  try {
    /** Process a list of documents to add information for chaining the api operations */
    logger.info("Processing documents");
    const sdkDocuments = processSdkDocuments(documents);

    /** Get all documents to be added to the root of the sdk */
    const rootDocuments = getRootDocuments(sdkDocuments);

    /** Ensure the nodes validate as a single application */
    const rootAst = concatAST(rootDocuments);

    /** Get a list of all fragment definitions */
    const rootFragments = getFragmentsFromAst(rootAst, config);

    /** Create and process a visitor for each node */
    logger.info("Generating root sdk");
    logger.debug({
      sdkDocuments: sdkDocuments.length,
      rootDocuments: rootDocuments.length,
      rootFragments: rootFragments.length,
    });
    const rootVisitor = createVisitor(schema, documents, rootDocuments, rootFragments, config);

    /** Get all chain keys to create chain apis */
    const chainKeys = getChainKeys(sdkDocuments);

    const chainVisitors = chainKeys.map(chainKey => {
      logger.info(`Generating ${chainKey} sdk`);

      /** Get a list of documents that are attached to this chain api key */
      const chainDocuments = getChildDocuments(sdkDocuments, chainKey);
      logger.debug({ [`${chainKey}Documents`]: chainDocuments.length });

      /** Create and process a visitor for each chained api */
      return createVisitor(schema, documents, chainDocuments, rootFragments, config, chainKey);
    });

    logger.info("Printing sdk");
    return {
      /** Add any initial imports */
      prepend: [
        /** Ignore unused variables */
        "/* eslint-disable @typescript-eslint/no-unused-vars */",
        /** Import DocumentNode if required */
        config.documentMode !== DocumentMode.string ? `import { DocumentNode } from 'graphql'` : undefined,
        /** Import ResultOf util for document return types */
        `import { ResultOf } from '@graphql-typed-document-node/core'`,
      ].filter(nonNullable),
      content: filterJoin(
        [
          /** Import and export documents */
          `import * as ${c.NAMESPACE_DOCUMENT} from '${config.documentFile}'`,
          `export * from '${config.documentFile}'\n`,
          /** Print the requester function */
          ...printRequesterType(config),
          /** Print the chained api functions */
          ...chainVisitors.map(v => v.visitor.sdkContent),
          /** Print the root function */
          rootVisitor.visitor.sdkContent,
        ],
        "\n"
      ),
    };
  } catch (e) {
    logger.fatal(e);
    throw e;
  }
};

/**
 * Validate use of the plugin
 */
export const validate: PluginValidateFn = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: RawSdkPluginConfig,
  outputFile: string
) => {
  const packageName = "@linear/sdk-plugin";
  logger.info(`Validating ${packageName}`);
  logger.debug({ config });

  const prefix = `Plugin "${packageName}" config requires`;

  if (extname(outputFile) !== ".ts") {
    throw new Error(`${prefix} output file extension to be ".ts" but is "${outputFile}"`);
  }

  if (!config.documentFile || typeof config.documentFile !== "string") {
    throw new Error(`${prefix} documentFile to be a string path to a document file generated by "typed-document-node"`);
  }
};

export { SdkVisitor };
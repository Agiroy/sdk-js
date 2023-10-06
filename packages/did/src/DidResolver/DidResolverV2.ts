/**
 * Copyright (c) 2018-2023, BOTLabs GmbH.
 *
 * This source code is licensed under the BSD 4-Clause "Original" license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { ConfigService } from '@kiltprotocol/config'
import { DidDocumentV2, DidResolverV2 } from '@kiltprotocol/types'
import { cbor } from '@kiltprotocol/utils'
import { linkedInfoFromChain } from '../Did2.rpc.js'
import { toChain } from '../Did2.chain.js'
import { getFullDidUri, parse, validateUri } from '../Did2.utils.js'
import { parseDocumentFromLightDid } from '../DidDetailsv2/LightDidDetailsV2.js'
import { KILT_DID_CONTEXT_URL, W3C_DID_CONTEXT_URL } from './DidContextsV2.js'

const DID_JSON = 'application/did+json'
const DID_JSON_LD = 'application/did+ld+json'
const DID_CBOR = 'application/did+cbor'

/**
 * Supported types for DID resolution and dereferencing.
 */
export type SupportedContentType =
  | typeof DID_JSON
  | typeof DID_JSON_LD
  | typeof DID_CBOR

function isValidContentType(input: unknown): input is SupportedContentType {
  return input === DID_JSON || input === DID_JSON_LD || input === DID_CBOR
}

type InternalResolutionResult = {
  document?: DidDocumentV2.DidDocument
  documentMetadata: DidResolverV2.ResolutionDocumentMetadata
}

async function resolveInternal(
  did: DidDocumentV2.DidUri
): Promise<InternalResolutionResult | null> {
  const { type } = parse(did)
  const api = ConfigService.get('api')

  const { document } = await api.call.did
    .query(toChain(did))
    .then(linkedInfoFromChain)
    .catch(() => ({ document: undefined }))

  if (type === 'full' && document !== undefined) {
    return {
      document,
      documentMetadata: {},
    }
  }

  const isFullDidDeleted = (await api.query.did.didBlacklist(toChain(did)))
    .isSome
  if (isFullDidDeleted) {
    return {
      // No canonicalId and no details are returned as we consider this DID deactivated/deleted.
      documentMetadata: {
        deactivated: true,
      },
    }
  }

  if (type === 'full') {
    return null
  }

  const lightDocument = parseDocumentFromLightDid(did, false)
  // If a full DID with same subject is present, return the resolution metadata accordingly.
  if (document !== undefined) {
    return {
      documentMetadata: {
        canonicalId: getFullDidUri(did),
      },
      document: {
        id: did,
      },
    }
  }

  // If no full DID details nor deletion info is found, the light DID is un-migrated.
  // Metadata will simply contain `deactivated: false`.
  return {
    document: lightDocument,
    documentMetadata: {},
  }
}

/**
 * Implementation of `resolve` compliant with W3C DID specifications (https://www.w3.org/TR/did-core/#did-resolution).
 * Additionally, this function returns an id-only DID document in the case where a DID has been deleted or upgraded.
 * If a DID is invalid or has not been registered, this is indicated by the `error` property on the `didResolutionMetadata`.
 *
 * @param did The DID to resolve.
 * @param resolutionOptions The resolution options accepted by the `resolve` function as specified in the W3C DID specifications (https://www.w3.org/TR/did-core/#did-resolution).
 * @returns The resolution result for the `resolve` function as specified in the W3C DID specifications (https://www.w3.org/TR/did-core/#did-resolution).
 */
export async function resolve(
  did: DidDocumentV2.DidUri,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resolutionOptions: DidResolverV2.ResolutionOptions = {}
): Promise<DidResolverV2.ResolutionResult> {
  try {
    validateUri(did, 'Did')
  } catch (error) {
    return {
      didResolutionMetadata: {
        error: 'invalidDid',
      },
      didDocumentMetadata: {},
    }
  }

  const resolutionResult = await resolveInternal(did)
  if (!resolutionResult) {
    return {
      didResolutionMetadata: {
        error: 'notFound',
      },
      didDocumentMetadata: {},
    }
  }

  const { documentMetadata: didDocumentMetadata, document: didDocument } =
    resolutionResult

  return {
    didResolutionMetadata: {},
    didDocumentMetadata,
    didDocument,
  }
}

/**
 * Implementation of `resolveRepresentation` compliant with W3C DID specifications (https://www.w3.org/TR/did-core/#did-resolution).
 * Additionally, this function returns an id-only DID document in the case where a DID has been deleted or upgraded.
 * If a DID is invalid or has not been registered, this is indicated by the `error` property on the `didResolutionMetadata`.
 *
 * @param did The DID to resolve.
 * @param resolutionOptions The resolution options accepted by the `resolveRepresentation` function as specified in the W3C DID specifications (https://www.w3.org/TR/did-core/#did-resolution).
 * @param resolutionOptions.accept The content type accepted by the requesting client.
 * @returns The resolution result for the `resolveRepresentation` function as specified in the W3C DID specifications (https://www.w3.org/TR/did-core/#did-resolution).
 */
export async function resolveRepresentation(
  did: DidDocumentV2.DidUri,
  { accept }: DidResolverV2.DereferenceOptions<SupportedContentType> = {
    accept: DID_JSON,
  }
): Promise<DidResolverV2.RepresentationResolutionResult<SupportedContentType>> {
  if (!isValidContentType(accept)) {
    return {
      didResolutionMetadata: {
        error: 'representationNotSupported',
      },
      didDocumentMetadata: {},
    }
  }

  const { didDocumentMetadata, didResolutionMetadata, didDocument } =
    await resolve(did)

  if (didDocument === undefined) {
    return {
      // Metadata is the same, since the `representationNotSupported` is already accounted for above.
      didResolutionMetadata,
      didDocumentMetadata,
    } as DidResolverV2.RepresentationResolutionResult<SupportedContentType>
  }

  const bufferInput = (() => {
    if (accept === 'application/did+json') {
      return JSON.stringify(didDocument)
    }
    if (accept === 'application/did+ld+json') {
      const jsonLdDoc: DidDocumentV2.JsonLd<DidDocumentV2.DidDocument> = {
        ...didDocument,
        '@context': [W3C_DID_CONTEXT_URL, KILT_DID_CONTEXT_URL],
      }
      return JSON.stringify(jsonLdDoc)
    }
    // contentType === 'application/did+cbor
    return cbor.encode(didDocument)
  })()

  return {
    didDocumentMetadata,
    didResolutionMetadata,
    didDocumentStream: Buffer.from(bufferInput),
  } as DidResolverV2.RepresentationResolutionResult<SupportedContentType>
}

type InternalDereferenceResult = {
  contentStream?: DidResolverV2.DereferenceContentStream
  contentMetadata: DidResolverV2.DereferenceContentMetadata
}

async function dereferenceInternal(
  didUrl: DidDocumentV2.DidUri | DidDocumentV2.DidUrl,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dereferenceOptions: DidResolverV2.DereferenceOptions<SupportedContentType>
): Promise<InternalDereferenceResult> {
  const { did, fragment } = parse(didUrl)

  const { didDocument, didDocumentMetadata } = await resolve(did)

  if (fragment === undefined) {
    return {
      contentStream: didDocument,
      contentMetadata: didDocumentMetadata,
    }
  }
  const dereferencedResource = (() => {
    const verificationMethod = didDocument?.verificationMethod.find(
      (m) => m.id === fragment
    )
    if (verificationMethod !== undefined) {
      return verificationMethod
    }

    const service = didDocument?.service?.find((s) => s.id === fragment)
    return service
  })()

  return {
    contentStream: dereferencedResource,
    contentMetadata: {},
  }
}

/**
 * Implementation of `dereference` compliant with W3C DID specifications (https://www.w3.org/TR/did-core/#did-url-dereferencing).
 * If a DID URL is invalid or has not been registered, this is indicated by the `error` property on the `dereferencingMetadata`.
 *
 * @param didUrl The DID URL to dereference.
 * @param resolutionOptions The resolution options accepted by the `dereference` function as specified in the W3C DID specifications (https://www.w3.org/TR/did-core/#did-url-dereferencing).
 * @param resolutionOptions.accept The content type accepted by the requesting client.
 * @returns The resolution result for the `dereference` function as specified in the W3C DID specifications (https://www.w3.org/TR/did-core/#did-url-dereferencing).
 */
export async function dereference(
  didUrl: DidDocumentV2.DidUri | DidDocumentV2.DidUrl,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { accept }: DidResolverV2.DereferenceOptions<SupportedContentType> = {
    accept: DID_JSON,
  }
): Promise<DidResolverV2.DereferenceResult<SupportedContentType>> {
  // The spec does not include an error for unsupported content types for dereferences
  const contentType = isValidContentType(accept) ? accept : DID_JSON

  try {
    validateUri(didUrl)
  } catch (error) {
    return {
      dereferencingMetadata: {
        error: 'invalidDidUrl',
      },
      contentMetadata: {},
    }
  }

  const resolutionResult = await dereferenceInternal(didUrl, {
    accept: contentType,
  })

  const { contentMetadata, contentStream } = resolutionResult

  if (contentStream === undefined) {
    return {
      dereferencingMetadata: {
        error: 'notFound',
      },
      contentMetadata,
    }
  }

  const stream = (() => {
    if (contentType === 'application/did+json') {
      return contentStream
    }
    if (contentType === 'application/did+ld+json') {
      return {
        ...contentStream,
        '@context': [W3C_DID_CONTEXT_URL, KILT_DID_CONTEXT_URL],
      }
    }
    // contentType === 'application/did+cbor'
    return Buffer.from(cbor.encode(contentStream))
  })()

  return {
    dereferencingMetadata: {
      contentType,
    },
    contentMetadata,
    contentStream: stream,
  }
}

/**
 * Fully-fledged default resolver capable of resolving DIDs in their canonical form, encoded for a specific content type, and of dereferencing parts of a DID Document according to the dereferencing specification.
 */
export const resolver: DidResolverV2.DidResolver<SupportedContentType> = {
  resolve,
  resolveRepresentation,
  dereference,
}

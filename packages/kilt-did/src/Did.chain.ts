/**
 * @packageDocumentation
 * @module DID
 */

import type { Option } from '@polkadot/types'
import type { IIdentity, SubmittableExtrinsic } from '@kiltprotocol/types'
import { BlockchainApiConnection } from '@kiltprotocol/chain-helpers'
import type { IDid } from '@kiltprotocol/core'
import type {
  DidDetails,
  IDidCreationOperation,
  IDidDeletionOperation,
  IDidUpdateOperation,
  PublicEncryptionKey,
  PublicVerificationKey,
  Url,
  UrlEncoding,
} from './types.chain'
import type {
  DidSigned,
  IDidRecord,
  KeyDetails,
  KeypairType,
  TypedPublicKey,
} from './types'
import { getDidFromIdentifier, getIdentifierFromDid } from './Did.utils'

export async function queryEncoded(
  did_identifier: IIdentity['address']
): Promise<Option<DidDetails>> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  return blockchain.api.query.did.did<Option<DidDetails>>(did_identifier)
}

function decodePublicKey(
  key: PublicVerificationKey | PublicEncryptionKey
): TypedPublicKey {
  return {
    type: key.type as KeypairType,
    publicKeyHex: key.value.toHex(),
  }
}

function decodeEndpointUrl(url: Url): string {
  return (url.value as UrlEncoding).payload.toString()
}

export async function queryById(
  did_identifier: IIdentity['address']
): Promise<IDidRecord | null> {
  const result = await queryEncoded(did_identifier)
  result.unwrapOr(null)
  if (result.isSome) {
    const didDetail = result.unwrap()
    const verification_keys: KeyDetails[] = Array.from(
      didDetail.verification_keys.entries()
    ).map(([keyId, keyDetails]) => {
      return {
        ...decodePublicKey(keyDetails.verification_key),
        id: keyId.toHex(),
        includedAt: keyDetails.block_number.toNumber(),
      }
    })
    const didRecord: IDidRecord = {
      did: getDidFromIdentifier(did_identifier),
      auth_key: decodePublicKey(didDetail.auth_key),
      key_agreement_key: decodePublicKey(didDetail.auth_key),
      verification_keys,
      last_tx_counter: didDetail.last_tx_counter.toNumber(),
    }
    if (didDetail.endpoint_url.isSome) {
      // that's super awkward but I guess there are reasons that the Url encoding needs to be a struct
      didRecord.endpoint_url = decodeEndpointUrl(
        didDetail.endpoint_url.unwrap()
      )
    }
    if (didDetail.delegation_key.isSome) {
      didRecord.delegation_key = decodePublicKey(
        didDetail.delegation_key.unwrap()
      )
    }
    if (didDetail.attestation_key.isSome) {
      didRecord.attestation_key = decodePublicKey(
        didDetail.attestation_key.unwrap()
      )
    }
    return didRecord
  }
  return null
}

export async function queryByDID(
  did: IDid['identifier']
): Promise<IDidRecord | null> {
  // we will have to extract the id part from the did string
  const didId = getIdentifierFromDid(did)
  return queryById(didId)
}

export async function create(
  createDid: DidSigned<IDidCreationOperation>
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  return blockchain.api.tx.did.submitDidCreateOperation(
    createDid.payload,
    createDid.signature
  )
}

export async function update(
  keyUpdate: DidSigned<IDidUpdateOperation>
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  return blockchain.api.tx.did.submitDidUpdateOperation(
    keyUpdate.payload,
    keyUpdate.signature
  )
}

export async function deactivate(
  keyRemoval: DidSigned<IDidDeletionOperation>
): Promise<SubmittableExtrinsic> {
  const blockchain = await BlockchainApiConnection.getConnectionOrConnect()
  return blockchain.api.tx.did.submitDidDeleteOperation(
    keyRemoval.payload,
    keyRemoval.signature
  )
}

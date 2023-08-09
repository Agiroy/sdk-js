/**
 * Copyright (c) 2018-2023, BOTLabs GmbH.
 *
 * This source code is licensed under the BSD 4-Clause "Original" license
 * found in the LICENSE file in the root directory of this source tree.
 */

import type { ApiPromise } from '@polkadot/api'
import type { Codec } from '@polkadot/types/types'
import { hexToU8a } from '@polkadot/util'
import {
  ed25519PairFromSeed,
  encodeAddress,
  randomAsU8a,
  secp256k1PairFromSeed,
} from '@polkadot/util-crypto'
import type { Keypair } from '@polkadot/util-crypto/types'

import { ConfigService } from '@kiltprotocol/config'
import { getFullDidUri, getFullDidUriFromKey } from '@kiltprotocol/did'
import type {
  DidDocument,
  DidVerificationKey,
  ResolvedDidKey,
  VerificationKeyType,
} from '@kiltprotocol/types'
import { Crypto } from '@kiltprotocol/utils'

import { ApiMocks } from '../../../tests/testUtils'
import {
  create as createJWT,
  credentialFromPayload,
  credentialToPayload,
  verify as verifyJWT,
} from './DidJwt'
import {
  create as createPresentation,
  signAsJwt,
  verifySignedAsJwt,
} from './Presentation'
import type { VerifiableCredential, VerifiablePresentation } from './types'

const credential = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://www.kilt.io/contexts/credentials',
  ],
  type: ['VerifiableCredential', 'KiltCredential2020'],
  id: 'kilt:cred:0x24195dd6313c0bb560f3043f839533b54bcd32d602dd848471634b0345ec88ad',
  credentialSubject: {
    '@context': {
      '@vocab':
        'kilt:ctype:0xf0fd09f9ed6233b2627d37eb5d6c528345e8945e0b610e70997ed470728b2ebf#',
    },
    birthday: '1991-01-01',
    name: 'Kurt',
    premium: true,
  },
  issuer: 'did:kilt:4sejigvu6STHdYmmYf2SuN92aNp8TbrsnBBDUj7tMrJ9Z3cG',
  issuanceDate: '2021-03-25T10:20:44.000Z',
  nonTransferable: true,
  proof: [
    {
      type: 'KILTAttestation2020',
      proofPurpose: 'assertionMethod',
      attester: 'did:kilt:4sejigvu6STHdYmmYf2SuN92aNp8TbrsnBBDUj7tMrJ9Z3cG',
    },
  ],
} as any

let api: ApiPromise
const seed = hexToU8a(
  '0xc48ea34c57ab63752ac5b797304de15cc036d126b96fb9c8198498d756c0579c'
)
const keyHash = Crypto.hashStr('key1')

function mockDidDoc(key: Keypair, type: VerificationKeyType) {
  const did = getFullDidUriFromKey({ ...key, type })
  const didKey: ResolvedDidKey = {
    id: `${did}#${keyHash}`,
    controller: did,
    publicKey: key.publicKey,
    type,
  }
  const didDocument: DidDocument = {
    uri: did,
    authentication: [{ ...didKey, id: `#${keyHash}` } as DidVerificationKey],
    assertionMethod: [{ ...didKey, id: `#${keyHash}` } as DidVerificationKey],
  }
  const onChainDoc = api.createType('Option<RawDidLinkedInfo>', {
    identifier: key.publicKey,
    details: {
      authenticationKey: keyHash,
      assertionMethod: keyHash,
      publicKeys: {
        [keyHash]: {
          key: { PublicVerificationKey: { [type]: key.publicKey } },
        },
      },
    },
  })
  return { did, didDocument, didKey, onChainDoc }
}

beforeAll(async () => {
  jest.useFakeTimers()
  jest.setSystemTime(1679407014000)
  api = ApiMocks.createAugmentedApi()
  api.call.did = {
    query: jest
      .fn()
      .mockResolvedValue(api.createType('Option<RawDidLinkedInfo>')),
  } as any
  api.query.did = {
    didBlacklist: jest.fn().mockResolvedValue(api.createType('Option<Null>')),
  } as any
  ConfigService.set({ api })
})

it('verifies a presentation signed by an ecdsa key', async () => {
  const key = secp256k1PairFromSeed(seed)
  const { did, didKey, onChainDoc } = mockDidDoc(key, 'ecdsa')
  jest.mocked(api.call.did.query).mockResolvedValue(onChainDoc)

  credential.credentialSubject.id = did

  const presentation = createPresentation([credential], did, {
    verifier: 'did:kilt:1234',
  })

  const signedPres = await signAsJwt(
    presentation,
    {
      ...key,
      keyUri: didKey.id,
      type: 'ecdsa',
    },
    { challenge: 'abcdef', expiresIn: 60 }
  )

  const myResult = await verifySignedAsJwt(signedPres, {
    verifier: 'did:kilt:1234',
    challenge: 'abcdef',
  })

  expect(myResult).toMatchObject({
    presentation,
    payload: { iss: did },
  })
})

it('verifies a presentation signed by an ed25519 key', async () => {
  const key = ed25519PairFromSeed(seed)
  const { did, didKey, onChainDoc } = mockDidDoc(key, 'ed25519')
  jest.mocked(api.call.did.query).mockResolvedValue(onChainDoc)

  credential.credentialSubject.id = did

  const presentation = createPresentation([credential], did, {
    verifier: 'did:kilt:1234',
  })

  const signedPres = await signAsJwt(
    presentation,
    {
      ...key,
      keyUri: didKey.id,
      type: 'ed25519',
    },
    { challenge: 'abcdef', expiresIn: 60 }
  )

  const myResult = await verifySignedAsJwt(signedPres, {
    verifier: 'did:kilt:1234',
    challenge: 'abcdef',
  })

  expect(myResult).toMatchObject({
    presentation,
    payload: { iss: did },
  })
})

it('verifies a credential signed by an ed25519 key', async () => {
  const key = ed25519PairFromSeed(seed)
  const { didKey, onChainDoc } = mockDidDoc(key, 'ed25519')
  jest.mocked(api.call.did.query).mockResolvedValue(onChainDoc)

  const cred = {
    ...credential,
    expiresAt: '2026-03-25T10:20:44.000Z',
  }

  const jwtCredential = await createJWT(credentialToPayload(cred), {
    ...key,
    keyUri: didKey.id,
    type: 'ed25519',
  })

  const result = await verifyJWT(jwtCredential, {
    proofPurpose: 'assertionMethod',
  })

  expect(credentialFromPayload(result.payload)).toMatchObject(cred)
})

it('fails if subject !== holder', async () => {
  const key = ed25519PairFromSeed(seed)
  const { did, didKey, onChainDoc } = mockDidDoc(key, 'ed25519')
  jest.mocked(api.call.did.query).mockResolvedValue(onChainDoc)

  credential.credentialSubject.id = did

  const presentation = createPresentation([credential], did)

  // test making presentations
  const randomDid = getFullDidUri(encodeAddress(randomAsU8a(), 38))
  credential.credentialSubject.id = randomDid
  expect(() =>
    createPresentation([credential], did)
  ).toThrowErrorMatchingInlineSnapshot(
    `"The credential with id kilt:cred:0x24195dd6313c0bb560f3043f839533b54bcd32d602dd848471634b0345ec88ad is non-transferable and cannot be presented by the identity did:kilt:4qqbHjqZ45gLCjsoNS3PXECZpYZqHZuoGyWJZm1Jz8YFhMoo"`
  )

  // test verifying presentations
  ;(
    presentation.verifiableCredential as VerifiableCredential
  ).credentialSubject.id = randomDid
  const signedPres = await signAsJwt(presentation, {
    ...key,
    keyUri: didKey.id,
    type: 'ed25519',
  })

  await expect(
    verifySignedAsJwt(signedPres, {})
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"The credential with id kilt:cred:0x24195dd6313c0bb560f3043f839533b54bcd32d602dd848471634b0345ec88ad is non-transferable and cannot be presented by the identity did:kilt:4qqbHjqZ45gLCjsoNS3PXECZpYZqHZuoGyWJZm1Jz8YFhMoo"`
  )
})

it('fails if expired or not yet valid', async () => {
  const key = ed25519PairFromSeed(seed)
  const { did, didKey, onChainDoc } = mockDidDoc(key, 'ed25519')
  jest.mocked(api.call.did.query).mockResolvedValue(onChainDoc)

  credential.credentialSubject.id = did

  const presentation = createPresentation([credential], did, {
    validFrom: new Date(Date.now() - 70_000), // 70 seconds ago
    validUntil: new Date(Date.now() - 10_000), // 10 seconds ago
  })

  let signedPres = await signAsJwt(
    presentation,
    {
      ...key,
      keyUri: didKey.id,
      type: 'ed25519',
    },
    { expiresIn: 30 }
  )

  await expect(
    verifySignedAsJwt(signedPres)
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"invalid_jwt: JWT has expired: exp: 1679406974 < now: 1679407014"`
  )

  // try setting expiration date with expiresAt
  signedPres = await signAsJwt(
    presentation,
    {
      ...key,
      keyUri: didKey.id,
      type: 'ed25519',
    },
    { expiresIn: 30 }
  )

  await expect(
    verifySignedAsJwt(signedPres)
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"invalid_jwt: JWT has expired: exp: 1679406974 < now: 1679407014"`
  )

  // should work if we set it to 80s
  signedPres = await signAsJwt(
    presentation,
    {
      ...key,
      keyUri: didKey.id,
      type: 'ed25519',
    },
    { expiresIn: 80 }
  )

  await expect(verifySignedAsJwt(signedPres)).resolves.toMatchObject({
    presentation: {
      ...presentation,
      expirationDate: new Date(
        new Date(presentation.issuanceDate as string).getTime() + 80_000
      ).toISOString(),
    },
  })

  // set issuanceDate to the future
  signedPres = await signAsJwt(
    {
      ...presentation,
      issuanceDate: new Date(Date.now() + 60 * 1000).toISOString(),
    },
    {
      ...key,
      keyUri: didKey.id,
      type: 'ed25519',
    }
  )

  await expect(
    verifySignedAsJwt(signedPres)
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"invalid_jwt: JWT not valid before nbf: 1679407074"`
  )
})

describe('when there is a presentation', () => {
  let signedPresentation: string
  let presentation: VerifiablePresentation
  let onChainDoc: Codec

  beforeAll(async () => {
    const key = ed25519PairFromSeed(seed)
    const mocks = mockDidDoc(key, 'ed25519')
    const { did, didKey } = mocks
    ;({ onChainDoc } = mocks)

    credential.credentialSubject.id = did

    presentation = createPresentation([credential], did, {
      verifier: 'did:kilt:1234',
    })

    signedPresentation = await signAsJwt(
      presentation,
      {
        ...key,
        keyUri: didKey.id,
        type: 'ed25519',
      },
      { challenge: 'abcdef', expiresIn: 60 }
    )
  })

  it('fails when DID doesnt exist', async () => {
    jest
      .mocked(api.call.did.query)
      .mockResolvedValue(api.createType('Option<RawDidLinkedInfo>'))

    await expect(
      verifySignedAsJwt(signedPresentation, {
        verifier: 'did:kilt:1234',
        challenge: 'abcdef',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"resolver_error: Unable to resolve DID document for did:kilt:4qqbHjqZ45gLCjsoNS3PXECZpYZqHZuoGyWJZm1Jz8YFhMoo: notFound, "`
    )
  })

  it('fails when audience does not match', async () => {
    jest.mocked(api.call.did.query).mockResolvedValue(onChainDoc)

    await expect(
      verifySignedAsJwt(signedPresentation, {
        verifier: 'did:kilt:4321',
        challenge: 'abcdef',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"invalid_config: JWT audience does not match your DID or callback url"`
    )
  })

  it('fails if challenge does not match', async () => {
    jest.mocked(api.call.did.query).mockResolvedValue(onChainDoc)

    await expect(
      verifySignedAsJwt(signedPresentation, {
        challenge: 'whatup',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"expected challenge not matching presentation"`
    )
  })
})

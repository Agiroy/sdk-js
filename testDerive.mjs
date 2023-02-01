import { connect, disconnect } from '@kiltprotocol/core'

const credential = {
  claim: {
    cTypeHash:
      '0x3291bb126e33b4862d421bfaa1d2f272e6cdfc4f96658988fbcffea8914bd9ac',
    contents: { Email: 'ingo@kilt.io' },
    owner: 'did:kilt:4sJm5Zsvdi32hU88xbL3v6VQ877P4HLaWVYUXgcSyQR8URTu',
  },
  claimHashes: [
    '0x8113c20adf617adb9fe3a2c61cc2614bf02cd58e0e42cb31356e7f5c052e65de',
    '0xa19685266e47579ecd72c30b31a928eef0bd71b7d297511c8bef952f2a5822a1',
  ],
  claimNonceMap: {
    '0x02eaa62e144281c9f73355cdb5e1f4edf27adc4e0510c2e60dca793c794dba6a':
      'e8f78c9e-70b5-48ea-990f-97782bc62c84',
    '0x1767f2220a9b07e22b73c5b36fa90e6f14338b6198e7696daf464914942734ab':
      '1f454fcc-dc73-46d4-9478-db5e4c8dda3b',
  },
  legitimations: [],
  delegationId: null,
  rootHash:
    '0x4fb274ed275ae1c3a719428088ffde0bbc10e456eba8aedc9687178a4ce47c20',
  claimerSignature: {
    keyId:
      'did:kilt:4sJm5Zsvdi32hU88xbL3v6VQ877P4HLaWVYUXgcSyQR8URTu#0xad991c68c9f1c6c4f869fa19a217db30aff0f74963ca7e26206f7102b229df5b',
    signature:
      '0xfa71e745c21d7b4ec6f8d54ac5b2fea9bacf91ffb8f56b359a3e5af0119957030a28944011690d404c59ea814c5324298db0ef5b3332868bbdcf33b25bb9f388',
  },
}

const api = await connect('wss://spiritnet.kilt.io')

await api.derive.credentials
  .verifyAttested(credential)
  .then((result) => console.log(result))
  .catch((e) => console.error('verification failed with ', e))

await api.derive.credentials
  .verifyAttested(credential)
  .then((result) => console.log(result))
  .catch((e) => console.error('verification failed with ', e))

api.derive.credentials.verifyAttested(credential, (r, e) => console.log(r, e))

//disconnect()

import CType from './CType'

describe('CType', () => {

    it('verify model transformations', () => {
        const ctypeInput = {
            "$id": "http://example.com/ctype-1",
            "$schema": "http://kilt-protocol.org/draft-01/ctype-input#",
            "properties": [
                {
                    "title": "First Property",
                    "$id": "first-property",
                    "type": "integer"
                },
                {
                    "title": "Second Property",
                    "$id": "second-property",
                    "type": "string"
                }
            ],
            "type": "object",
            "title": "CType Title",
            "required": ["first-property", "second-property"]
        };
        const ctypeModel = {
            "schema": {
                "$id": "http://example.com/ctype-1",
                "$schema": "http://kilt-protocol.org/draft-01/ctype#",
                "properties": {"first-property": {"type": "integer"}, "second-property": {"type": "string"}},
                "type": "object"
            },
            "metadata": {
                "title": {"default": "CType Title"},
                "description": {},
                "properties": {
                    "first-property": {"title": {"default": "First Property"}},
                    "second-property": {"title": {"default": "Second Property"}}
                }
            }
        };
        const claimInput = {
            "$id": "http://example.com/ctype-1",
            "$schema": "http://kilt-protocol.org/draft-01/ctype#",
            "properties": {
                "first-property": {"type": "integer", "title": "First Property"},
                "second-property": {"type": "string", "title": "Second Property"}
            },
            "type": "object",
            "title": "CType Title",
            "required": ["first-property", "second-property"]
        };
        const goodClaim = {
            "first-property": 10,
            "second-property": "12"
        };
        const badClaim = {
            "first-property": "1",
            "second-property": "12",
            "third-property": true
        };

        let ctypeFromInput = CType.fromInputModel(ctypeInput);
        let ctypeFromModel = new CType(ctypeModel);
        expect(JSON.stringify(ctypeFromInput.getModel())).toEqual(JSON.stringify(ctypeFromModel.getModel()));
        expect(JSON.stringify(ctypeFromInput.getClaimInputModel("en"))).toEqual(JSON.stringify(claimInput));
        expect(JSON.stringify(ctypeFromInput.getCTypeInputModel())).toEqual(JSON.stringify(ctypeInput));
        expect(ctypeFromInput.verifyClaimStructure(goodClaim)).toBeTruthy();
        expect(ctypeFromInput.verifyClaimStructure(badClaim)).toBeFalsy();
    })


});
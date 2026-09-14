import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resetCreditDetails} from '../codex-usage.mjs';
test('reset credits preserve authoritative count, expiration and incomplete detail lists',()=>{
 assert.deepEqual(resetCreditDetails({availableCount:5,credits:[{status:'available',expiresAt:1893456000},{status:'available',expiresAt:null},{status:'available'},{status:'redeemed',expiresAt:1893456000},{status:'redeeming',expiresAt:null}]}),{resetsAvailable:5,resetCredits:[{expiresAt:1893456000},{expiresAt:null},{expiresAt:undefined}]});
 assert.deepEqual(resetCreditDetails({availableCount:4,credits:null}),{resetsAvailable:4,resetCredits:null});
 assert.deepEqual(resetCreditDetails({availableCount:0,credits:[]}),{resetsAvailable:0,resetCredits:[]});
 assert.deepEqual(resetCreditDetails(undefined),{resetsAvailable:null,resetCredits:null});
 assert.deepEqual(resetCreditDetails({availableCount:-1,credits:[{status:'available',expiresAt:'invalid'}]}),{resetsAvailable:null,resetCredits:[{expiresAt:undefined}]});
});

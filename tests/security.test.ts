import assert from "node:assert/strict"
import test from "node:test"
import { isTrustedOrigin } from "../lib/server/origin.ts"

test("same-origin state-changing requests are accepted", () => {
  assert.equal(isTrustedOrigin({
    host: "localhost:3000",
    origin: "http://localhost:3000",
    protocol: "http"
  })
  , true)
})

test("configured app origin is accepted behind a proxy", () => {
  assert.equal(isTrustedOrigin({
    appOrigin: "https://ledger.example.com",
    host: "internal:3000",
    origin: "https://ledger.example.com",
    protocol: "http"
  })
  , true)
})

test("cross-site state-changing requests are rejected", () => {
  assert.equal(isTrustedOrigin({
    host: "localhost:3000",
    origin: "https://attacker.example",
    protocol: "http"
  })
  , false)
})

test("malformed origin headers are rejected without throwing", () => {
  assert.doesNotThrow(() => {
    assert.equal(isTrustedOrigin({
      host: "localhost:3000",
      origin: "not a url",
      protocol: "http"
    }), false)
  })
})

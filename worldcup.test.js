const nock = require('nock');
const wc = require('./worldcup')

test('.request', async () => {
  const data = JSON.stringify({ foo: 'bar' })

  const options = {
    hostname: 'example.com',
    port: 443,
    path: '/hello',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    },
  }

  const scope = nock('https://example.com')
    .post('/hello', { foo: 'bar' })
    .reply(200, { data: 'value' })

  const resp = await wc.request(options, data)
  expect(resp).toStrictEqual({ data: 'value' })
})


test('.getUrl', async () => {
  const url = 'https://example.com/foo'
  const scope = nock('https://example.com')
    .get('/foo')
    .reply(200, {value: 'bar'})

  const resp = await wc.getUrl(url)
  expect(resp).toStrictEqual({ value: 'bar' })
})

test('.postUrl', async () => {
  const data = {goo: 'ber'}
  const url = 'https://example.com/foo'
  const scope = nock('https://example.com')
    .post('/foo', data)
    .reply(200, {value: 'bar'})

  const resp = await wc.postUrl(url, data)
  expect(resp).toStrictEqual({ value: 'bar' })
})

test('.postToSlack', async () => {
  const scope = nock('https://slack.com')
    .post('/api/chat.postMessage')
    .reply(200, {ok: true})

  const subject = 'subject'
  const details = 'details'
  const resp = await wc.postToSlack(subject, details)
  expect(resp.ok).toBe(true)
})

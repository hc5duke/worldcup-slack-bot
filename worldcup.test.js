const nock = require('nock');
const worldcup = require('./worldcup')

test('internet disabled', async () => {
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

  const resp = await worldcup.request(options, data)
  expect(resp).toStrictEqual({ data: 'value' })
})

test('getUrl', async () => {
  const url = 'https://example.com/foo'
  const scope = nock('https://example.com')
    .get('/foo')
    .reply(200, {value: 'bar'})

  const resp = await worldcup.getUrl(url)
  expect(resp).toStrictEqual({ value: 'bar' })
})

const nock = require('nock');
const wc = require('./worldcup')

describe('worldcup', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
    process.env.S3_BUCKET = '__test_dummy_bucket__'
    process.env.S3_KEY = '__test_dummy_key__'
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

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

  test('.getLatestData', async () => {
    const s3 = mockS3()

    const resp = await wc.getLatestData(s3)
    expect(resp).toStrictEqual(defaultS3Data)
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

  const defaultS3Data = {"liveMatches":[{}, {}],"etag":{a: {}, b: {}}}
  const mockS3 = (data) => {
    if (!data) {
      data = {}
      data[process.env.S3_BUCKET] = {}
      data[process.env.S3_BUCKET][process.env.S3_KEY] = JSON.stringify(defaultS3Data)
    }

    return {
      getObject: params => {
        return {
          promise: async () => {
            return {
              Body: data[params.Bucket][params.Key]
            }
          }
        }
      }
    }
  }
})

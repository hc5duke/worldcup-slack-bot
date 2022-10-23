/**
 * WorldCup Bot for Slack.
 *
 * #######################################
 * # converted for AWS Lambda - @hc5duke #
 * #   - PHP -> node.js                  #
 * #   - json file db -> S3              #
 * #   - en-GB -> en-US                  #
 * #   - removed proxy support           #
 * #   - added DEBUG_MODE                #
 * #######################################
 *
 * It uses the unofficial FIFA json API (the one used for their mobile app iOS/Android).
 * It will post a message :
 *   - when a match starts
 *   - for red/yellow card
 *   - for the half time and end time
 *   - for every penalty
 *   - and of course, for every goal
 *
 * You will need a token from Slack.
 * Jump at https://api.slack.com/custom-integrations/legacy-tokens and you will find your token.
 *
 * @author j0k <jeremy.benoist@gmail.com>
 * @license MIT
 */

const AWS   = require('aws-sdk')
const https = require('https')
const qs    = require('querystring')
const URL   = require('url')

const s3    = new AWS.S3();

// Slack stuff
const SLACK_TOKEN      = process.env.SLACK_TOKEN
const SLACK_CHANNEL    = process.env.SLACK_CHANNEL
const SLACK_BOT_NAME   = 'WorldCup Bot'
const SLACK_BOT_AVATAR = 'https://i.imgur.com/Pd0cpqE.png'
const DEBUG_MODE       = true
const S3_BUCKET        = process.env.S3_BUCKET
const S3_KEY           = process.env.S3_KEY

// Set to the language for updates
const LOCALE = 'en-US'

const i18n = {
  'fr-FR': [
    'Le match',
    'est sur le point de commencer',
    'Carton jaune',
    'Carton rouge',
    'But contre son camp',
    'Pénalty',
    'BUUUUUT',
    'Pénalty manqué',
    'commence',
    'Mi-temps',
    'Fin de la 2e période',
    'a repris',
    'Mi-temps de la prolongation',
    'Fin de la prolongation',
    'Fin de la séance de tirs au but',
  ],
  'es-ES': [
    'El partido entre',
    'está por comenzar',
    'tarjeta amarilla',
    'tarjeta roja',
    'Autogol',
    'Penalti',
    'GOOOOOL',
    'Penal fallado',
    'ha comenzado',
    'MEDIO TIEMPO',
    'TIEMPO COMPLETO',
    'se ha reanudado',
    'la mitad de la prórroga',
    'el final de la prórroga',
    'tanda de penales',
  ],
  'en-US': [
    'The match between',
    'is about to start',
    'Yellow card',
    'Red card',
    'Own goal',
    'Penalty',
    'GOOOOAL',
    'Missed penalty',
    'has started',
    'HALF TIME',
    'FULL TIME',
    'has resumed',
    'END OF 1ST ET',
    'END OF 2ND ET',
    'END OF PENALTY SHOOTOUT',
  ]
}

/**
 * FIFA API
 */

// 2022 World Cup
const ID_COMPETITION = 17; // je ne sais quoi
const ID_SEASON = 255711;  // WC 2022

// Match Statuses
const MATCH_STATUS_FINISHED = 0;
const MATCH_STATUS_NOT_STARTED = 1;
const MATCH_STATUS_LIVE = 3;
const MATCH_STATUS_PREMATCH = 12; // Maybe?

// Event Types
const EVENT_GOAL = 0;
const EVENT_YELLOW_CARD = 2;
const EVENT_STRAIGHT_RED = 3;
const EVENT_SECOND_YELLOW_CARD_RED = 4; // Maybe?
const EVENT_PERIOD_START = 7;
const EVENT_PERIOD_END = 8;
const EVENT_END_OF_GAME = 26;
const EVENT_OWN_GOAL = 34;
const EVENT_FREE_KICK_GOAL = 39;
const EVENT_PENALTY_GOAL = 41;
const EVENT_PENALTY_SAVED = 60;
const EVENT_PENALTY_CROSSBAR = 46;
const EVENT_PENALTY_MISSED = 65;
const EVENT_FOUL_PENALTY = 72;

// Periods
const PERIOD_1ST_HALF = 3;
const PERIOD_2ND_HALF = 5;
const PERIOD_1ST_ET   = 7;
const PERIOD_2ND_ET   = 9;
const PERIOD_PENALTY  = 11;

const MATCH_OPTS = {
  idCompetition: ID_COMPETITION,
  idSeason:      ID_SEASON,
  count:         500,
  language:      LOCALE
}

// URLs
const URL_SLACK   = 'https://slack.com/api/chat.postMessage'
const URL_PLAYERS = 'https://api.fifa.com/api/v1/players/'
const URL_MATCHES = 'https://api.fifa.com/api/v1/calendar/matches' + '?' + qs.encode(MATCH_OPTS)

const worldcup = {
  getLatestData: async (s3) => {
    try {
      var getParams = {
        Bucket: S3_BUCKET,
        Key:    S3_KEY
      }
      var obj = await s3.getObject(getParams).promise()
      return obj.Body
    } catch(e) {
      console.error(e)
    } finally {
      return {
        liveMatches: [],
        etag: {}
      }
    }
  },

  getUrl: (urlString, headers) => {
    const url = URL.parse(urlString)
    const options = {
      hostname: url.hostname,
      port:     443,
      path:     url.path,
      method:   'GET',
      headers:  headers,
    }

    return worldcup.request(options)
  },

  postUrl: (urlString, data, headers = {}) => {
    const url = URL.parse(urlString)
    const dataString = JSON.stringify(data)

    headers['Content-Type'] = 'application/json; charset=utf-8'
    headers['Content-Length'] = dataString.length
    const options = {
      hostname: url.hostname,
      port:    443,
      path:    url.path,
      method:  'POST',
      headers: headers,
    }

    debug(options)

    return worldcup.request(options, dataString)
  },

  // use https.request as async
  request: (options, data) => {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          resolve(JSON.parse(responseBody));
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(data)
      }

      req.end();
    });
  },

  postToSlack: (text, attachmentText) => {
    const headers = {
      Authorization: 'Bearer ' + SLACK_TOKEN
    }
    const options = {
      channel:      SLACK_CHANNEL,
      text:         text
    }

    if (attachmentText) {
      options.attachments = [
        { text: attachmentText }
      ]
    }

    debug('slack url', URL_SLACK)
    debug('slack opts', options)
    return worldcup.postUrl(URL_SLACK, options, headers)
  },

  getEventPlayerAlias: async eventPlayerId => {
    const response = await worldcup.getUrl(URL_PLAYERS + eventPlayerId)
    return response.Alias[0].Description
  },

  parseMatches: (response, db) => {
    if (response === null) return

    const matches = response.Results
    for (var i = 0, len = matches.length; i < len; i++) {
      const match = matches[i]
    }
  },

  postLiveEvents: async db => {
    homeTeamName = 'S. Korea'
    awayTeamName = 'Germany'
    eventPlayerAlias = 'Choi'
    matchTime = "23'"
    score = '1:0'
    subject = ':zap: ' + i18n[LOCALE][0] + ' '
      + homeTeamName + ' / '
      + awayTeamName + ' '
      + i18n[LOCALE][8] + '!'
    details = eventPlayerAlias + ' (' + matchTime + ') ' + score;
    return worldcup.postToSlack(subject, details)
  },

  saveLatestData: (s3, db) => {
  },

  run: async () => {
    const db = worldcup.getLatestData(s3)

    // we care about ETag with this
    const response = await worldcup.getUrl(URL_MATCHES)

    worldcup.parseMatches(response, db)
    await worldcup.postLiveEvents(db)
    await worldcup.saveLatestData(s3, db)
  }
}

const debug = (title, info) => {
  if (!DEBUG_MODE) return

  console.log(title, info)
}

exports.handler = async (event, context) => {
  worldcup.run()
}

module.exports = worldcup

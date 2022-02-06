import axios from 'axios';
import * as AWS from 'aws-sdk';

export default class ElasticDataLoader {
  constructor(config) {
    this.config = config;
  }

  async load(req) {
    try {
      if (this.config.accessKeyId && this.config.secretAccessKey) {
        const signedRequest = this.createSignedRequest(req);
        const client = new AWS.HttpClient();
        const data = await new Promise((resolve, reject) => {
          client.handleRequest(
            signedRequest,
            null,
            (response) => {
              let responseBody = '';
              response.on('data', (chunk) => {
                responseBody += chunk;
              });
              response.on('end', () => {
                resolve(responseBody);
              });
            },
            (err) => {
              reject(err);
            },
          );
        });
        return JSON.parse(data);
      } else {
        const { data } = await axios.request({
          baseURL: this.config.endpoint,
          url: req.path,
          headers: req.params.headers,
          params: req.params.queryString,
          method: req.operation.toLowerCase(),
          data: req.params.body,
        });

        return data;
      }
    } catch (err) {
      console.log(err);
    }

    return null;
  }

  createSignedRequest(req) {
    const domain = this.config.endpoint.replace('https://', '');
    const headers = {
      ...req.params.headers,
      host: domain,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(req.params.body),
    };
    const endpoint = new AWS.Endpoint(domain);
    const httpRequest = new AWS.HttpRequest(endpoint, this.config.region);
    httpRequest.headers = headers;
    httpRequest.body = req.params.body;
    httpRequest.method = req.operation;
    httpRequest.path = req.path;

    const signer = new AWS.Signers.V4(httpRequest, 'es');
    const credentials = {
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
    };
    signer.addAuthorization(credentials, new Date());

    return httpRequest;
  }
}

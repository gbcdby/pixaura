declare module "@alicloud/dysmsapi20170525" {
  export default class Dysmsapi20170525 {
    constructor(config: {
      accessKeyId: string;
      accessKeySecret: string;
      endpoint: string;
    });
    sendSms(
      request: SendSmsRequest,
    ): Promise<{ body: { code: string; message?: string } }>;
  }

  export class SendSmsRequest {
    constructor(options: {
      phoneNumbers: string;
      signName: string;
      templateCode: string;
      templateParam?: string;
    });
  }
}

declare module "@alicloud/openapi-client" {
  export class Config {
    accessKeyId: string;
    accessKeySecret: string;
    endpoint?: string;
    constructor(options: { accessKeyId: string; accessKeySecret: string });
  }
}

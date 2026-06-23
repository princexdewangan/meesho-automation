declare module 'qrcode-terminal' {
  export function generate(qr: string, options?: { small: boolean }): void;
}

declare module 'whatsapp-web.js' {
  export class Client {
    constructor(options?: any);
    on(event: string, callback: (...args: any[]) => void): void;
    initialize(): Promise<void>;
    getChats(): Promise<any[]>;
  }
  
  export class LocalAuth {
    constructor(options?: { dataPath?: string; clientId?: string });
  }
}

import { Logger } from "homebridge";
import { Telnet } from "telnet-client";

type Command = {
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
  cmd: string;
};

type ConnectionOptions = {
  host: string;
  port: number;
  shellPrompt: string;
  timeout: number;
};

export class CommandQueue {
  private isProcessing = false;
  private queue: Command[] = [];

  private client: Telnet;
  private log: Logger;
  private opts: ConnectionOptions;

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_INTERVAL = 2000;

  constructor(opts: ConnectionOptions, log: Logger) {
    this.client = new Telnet();
    this.opts = opts;
    this.log = log;

    this.initializeConnection();
  }

  async addCommand(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, cmd });
      this.processQueue();
    });
  }

  private async initializeConnection(
    retries = this.MAX_RETRIES
  ): Promise<void> {
    if (retries <= 0) {
      this.log.error(
        "Max retries reached. Failed to establish a Telnet connection."
      );
      return;
    }

    try {
      await this.client.connect(this.opts);
    } catch (error) {
      this.log.error(
        `Failed to connect to Telnet server on attempt ${
          this.MAX_RETRIES - retries + 1
        }:`,
        error
      );
      setTimeout(
        () => this.initializeConnection(retries - 1),
        this.RETRY_INTERVAL
      );
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { resolve, reject, cmd } = this.queue.shift()!;

    try {
      const result = await this.sendTelnetCommand(cmd, this.MAX_RETRIES);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessing = false;
      this.processQueue();
    }
  }

  private async sendTelnetCommand(
    cmd: string,
    retries: number
  ): Promise<string> {
    if (retries <= 0) {
      throw new Error(
        "Max retries reached. Failed to send command via Telnet."
      );
    }

    try {
      return await this.client.send(cmd);
    } catch (error) {
      this.log.warn(
        `Failed to send command on attempt ${this.MAX_RETRIES - retries + 1}:`,
        error
      );

      // Optionally, reinitialize the connection before retrying
      await this.initializeConnection();

      // Wait and retry
      await new Promise((resolve) => setTimeout(resolve, this.RETRY_INTERVAL));
      return this.sendTelnetCommand(cmd, retries - 1);
    }
  }

  destroy() {
    this.client.destroy();
  }
}

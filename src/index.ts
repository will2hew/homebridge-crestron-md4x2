import { API, Logger, PlatformAccessory, PlatformConfig } from "homebridge";
import { CommandQueue } from "./crestron";

const PLUGIN_NAME = "@hewittwill/homebridge-enfield-av";
const PLATFORM_NAME = "EnfieldAV";

type InputOutputType = {
  id: number;
  name: string;
};

const OUTPUTS: InputOutputType[] = [
  { id: 1, name: "Lounge TV" },
  { id: 2, name: "Bedroom TV" },
];

const INPUTS: InputOutputType[] = [
  { id: 2, name: "PS5" },
  { id: 3, name: "Apple TV" },
  { id: 4, name: "PS2" },
];

module.exports = (api) => {
  api.registerPlatform(PLATFORM_NAME, EnfieldAVPlugin);
};

interface EnfieldAVConfig extends PlatformConfig {
  ip: string;
}

class EnfieldAVPlugin {
  private readonly accessories: PlatformAccessory[] = [];

  private readonly commandQueue: CommandQueue;

  constructor(
    public readonly log: Logger,
    public readonly config: EnfieldAVConfig,
    public readonly api: API
  ) {
    this.log = log;
    this.config = config;
    this.api = api;

    this.commandQueue = new CommandQueue(
      {
        host: this.config.ip,
        port: 23,
        shellPrompt: ">",
        timeout: 1500,
      },
      log
    );

    for (const output of OUTPUTS) {
      this.accessories.push(this.createOutputAccessory(output));
    }

    this.api.publishExternalAccessories(PLUGIN_NAME, this.accessories);
  }

  private createOutputAccessory(output: InputOutputType): PlatformAccessory {
    const uuid = this.api.hap.uuid.generate(
      `homebridge:enfield-av-${output.id}`
    );

    const accessory = new this.api.platformAccessory(output.name, uuid);

    accessory.category = this.api.hap.Categories.TELEVISION;

    const service = accessory.addService(this.api.hap.Service.Television);

    // Set the configured name of the service
    service.setCharacteristic(
      this.api.hap.Characteristic.ConfiguredName,
      output.name
    );

    // Set sleep discovery characteristic
    service.setCharacteristic(
      this.api.hap.Characteristic.SleepDiscoveryMode,
      this.api.hap.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE
    );

    service.setCharacteristic(this.api.hap.Characteristic.Active, 1);

    // handle input source changes
    service
      .getCharacteristic(this.api.hap.Characteristic.ActiveIdentifier)
      .onGet(async () => {
        this.log.debug(`Getting current input for ${output.name}`);

        const response = await this.commandQueue.addCommand(
          `show output ${output.id} route`
        );

        const parts = response.split(" ");

        const connectedInput = parseInt(parts[4]);

        if (parts[0] !== "event") {
          this.log.error("Invalid response from Crestron");
          return 0;
        } else {
          this.log.debug(
            `${output.name} is connected to ${
              INPUTS.find((val) => val.id === connectedInput)?.name
            }`
          );
          return connectedInput;
        }
      })
      .onSet(async (rawInput) => {
        const inputId = parseInt(rawInput.toString());
        const input = this.getInputById(inputId);

        this.log.debug(`Setting input for ${output.name} to ${input.name}`);

        await this.commandQueue.addCommand(
          `conf output ${output.id} route ${input.id}`
        );
      });

    // handle remote control input
    service
      .getCharacteristic(this.api.hap.Characteristic.RemoteKey)
      .onSet((newValue) => {
        switch (newValue) {
          case this.api.hap.Characteristic.RemoteKey.REWIND: {
            this.log.info("set Remote Key Pressed: REWIND");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.FAST_FORWARD: {
            this.log.info("set Remote Key Pressed: FAST_FORWARD");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.NEXT_TRACK: {
            this.log.info("set Remote Key Pressed: NEXT_TRACK");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.PREVIOUS_TRACK: {
            this.log.info("set Remote Key Pressed: PREVIOUS_TRACK");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.ARROW_UP: {
            this.log.info("set Remote Key Pressed: ARROW_UP");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.ARROW_DOWN: {
            this.log.info("set Remote Key Pressed: ARROW_DOWN");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.ARROW_LEFT: {
            this.log.info("set Remote Key Pressed: ARROW_LEFT");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.ARROW_RIGHT: {
            this.log.info("set Remote Key Pressed: ARROW_RIGHT");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.SELECT: {
            this.log.info("set Remote Key Pressed: SELECT");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.BACK: {
            this.log.info("set Remote Key Pressed: BACK");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.EXIT: {
            this.log.info("set Remote Key Pressed: EXIT");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.PLAY_PAUSE: {
            this.log.info("set Remote Key Pressed: PLAY_PAUSE");
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.INFORMATION: {
            this.log.info("set Remote Key Pressed: INFORMATION");
            break;
          }
        }
      });

    INPUTS.forEach((input) => {
      const inputService = accessory.addService(
        this.api.hap.Service.InputSource,
        `hdmi${input.id}`,
        input.name
      );

      inputService
        .setCharacteristic(this.api.hap.Characteristic.Identifier, input.id)
        .setCharacteristic(
          this.api.hap.Characteristic.ConfiguredName,
          input.name
        )
        .setCharacteristic(
          this.api.hap.Characteristic.IsConfigured,
          this.api.hap.Characteristic.IsConfigured.CONFIGURED
        )
        .setCharacteristic(
          this.api.hap.Characteristic.InputSourceType,
          this.api.hap.Characteristic.InputSourceType.HDMI
        );

      service.addLinkedService(inputService);
    });

    return accessory;
  }

  private getInputById(id: number): InputOutputType {
    const input = INPUTS.find((val) => val.id === id);

    if (input) {
      return input;
    } else {
      throw new Error(`No input found with the ID ${id}`);
    }
  }

  public configureAccessory(accessory) {
    this.accessories.push(accessory);
  }
}

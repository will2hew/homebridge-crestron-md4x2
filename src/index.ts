import { API, Logger, PlatformAccessory, PlatformConfig } from "homebridge";
import { CommandQueue } from "./crestron";

const PLUGIN_NAME = "@will2hew/homebridge-crestron-md4x2";
const PLATFORM_NAME = "Crestron";

type Device = {
  id: number;
  name: string;
};

module.exports = (api) => {
  api.registerPlatform(PLATFORM_NAME, CrestronPlugin);
};

interface CrestronConfig extends PlatformConfig {
  ip: string;
  inputs: Device[];
  outputs: Device[];
}

class CrestronPlugin {
  private readonly accessories: PlatformAccessory[] = [];

  private readonly commandQueue: CommandQueue;

  constructor(
    public readonly log: Logger,
    public readonly config: CrestronConfig,
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

    if (this.config.inputs.length === 0 || this.config.outputs.length === 0) {
      this.log.warn(
        "No inputs or outputs configured in config.json. Using default values instead."
      );
    }

    for (const output of this.config.outputs) {
      this.accessories.push(this.createOutputAccessory(output));
    }

    this.api.publishExternalAccessories(PLUGIN_NAME, this.accessories);
  }

  private createOutputAccessory(output: Device): PlatformAccessory {
    const uuid = this.api.hap.uuid.generate(
      `homebridge:crestron-output-${output.id}`
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
              this.config.inputs.find((val) => val.id === connectedInput)?.name
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
      .onSet(() => {
        this.log.warn("Output control is not implemented yet");
      });

    this.config.inputs.forEach((input) => {
      const inputService = accessory.addService(
        this.api.hap.Service.InputSource,
        `hdmi-${input.id}`,
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

  private getInputById(id: number): Device {
    const input = this.config.inputs.find((val) => val.id === id);

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

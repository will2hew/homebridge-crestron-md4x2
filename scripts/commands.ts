import { Telnet } from "telnet-client";

async function getInputName(): Promise<void> {
  const client = new Telnet();

  await client.connect({
    host: "192.168.1.81",
    port: 23,
    shellPrompt: ">",
    timeout: 1500,
  });

  for (let i = 0; i < 50; i++) {
    const res = await client.send(`conf output 2 video cec sendmessage ${i}`);

    console.log(res);
  }

  //   setInterval(async () => {
  //     console.log("sendign");

  //     console.log(res);
  //     count++;
  //   }, 1000);

  client.destroy();
}

getInputName();

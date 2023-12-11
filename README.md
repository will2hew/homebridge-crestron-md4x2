# Homebridge Crestron

This plugin exposes a Television service for each Output of a Crestron HDMI switcher. Then for each Input, it creates an InputSource service. The end result is the being able to select the output being sent to each TV, right from within Homebridge.

It uses telnet to control the Crestron HDMI switcher.

## Compatible Devices

So far, I have only tested this plugin on one device. If other people are able to test it on their own devices, I will update this list.

- [Crestron HD-MD4X2-4K-E](https://www.crestron.com/Products/Video/HDMI-Solutions/HDMI-Switchers/HD-MD4X2-4K-E)

## Installation

You can install this plugin via. the Homebridge UI or by running the command

`npm install -g @will2hew/homebridge-crestron-md4x2`

## Configuration

1. Configure the IP address of the Crestron, which is usually displayed on the 16x2 LCD on top of the unit.

!(assets/configure-ip.png)

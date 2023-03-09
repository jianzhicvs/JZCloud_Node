#!/bin/bash
sudo -b echo -n `btrfs filesystem show $1 | awk '{print $8}' | awk -F% '{print $1}' | sed -n '3p'`
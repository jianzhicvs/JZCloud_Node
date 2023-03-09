#!/bin/bash
case "$1" in
   "cpu") top -n 1 -b |  sed -e 's/ //g' | grep "Cpu(s):" | awk -F ":" '{print $2}' | awk -F "," '{print $1}' | awk -F "%" '{print $1}'
   ;;
   "ram") free -h | awk '{print $7}' | awk -F% '{print $1}' | sed -n '2p'
   ;;
   "disk") df -m / | awk '{print $4}' | awk -F% '{print $1}' | sed -n '2p'
   ;;
   "load") cat /proc/loadavg | awk '{print $1"|"$2"|"$3}'
   ;;
esac
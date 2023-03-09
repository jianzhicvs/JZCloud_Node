#!/bin/bash
case "$1" in
   "size") sudo -b echo -n `df -h /cloudisk/$2 | awk '{print $2}' | awk -F% '{print $1}'| sed -n '2p'`
   ;;
   "used") sudo -b echo -n `df -h /cloudisk/$2 | awk '{print $3}' | awk -F% '{print $1}'| sed -n '2p'`
   ;;
   "avail") sudo -b echo -n `df -h /cloudisk/$2 | awk '{print $4}' | awk -F% '{print $1}'| sed -n '2p'`
   ;;
   "use") sudo -b echo -n `df -h /cloudisk/$2 | awk '{print $5}' | awk -F% '{print $1}'| sed -n '2p'`
   ;;
esac
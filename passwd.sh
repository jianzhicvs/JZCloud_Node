#!/bin/bash
# Simple To Cloud Reset Password Shell
# 请勿删除此脚本

echo "root:$1" | chpasswd;

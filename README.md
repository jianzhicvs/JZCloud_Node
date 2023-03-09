# JZCloud_Node
简致云虚拟化被控端LXD

## Installation

LXD安装

```sh
yum install epel-release yum-plugin-copr -y
yum -y install snapd
systemctl enable --now snapd.socket
ln -s /var/lib/snapd/snap /snap
```

调整内核

```sh
grubby --args="user_namespace.enable=1" --update-kernel="$(grubby --default-kernel)"
grubby --args="namespace.unpriv_enable=1" --update-kernel="$(grubby --default-kernel)"
echo "user.max_user_namespaces=3883" > /etc/sysctl.d/99-userns.conf
reboot
```

创建lxd组

```sh
groupadd -g 994 lxd
usermod -a -G lxd root
newgrp lxd
```

下载LXD 并安装

```sh
snap install lxd
```
(第一次不行就再试一次  再不行就重启再安装)

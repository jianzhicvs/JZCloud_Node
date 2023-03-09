var shell = require("shelljs");
var request = require('request');
var express = require('express');
var YAML = require('yamljs');
var mysql = require('mysql');
var app = express();
var Config = require('./config');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.use('/node_modules', express.static('node_modules'));

app.get('/index.html', function(req, res) {
    res.sendFile(__dirname + "/" + "index.html");
})

app.get('/ymal_shell', function(req, res) {
    console.log(req);
    var a = shell.exec(req.query.shell).stdout;
    var Ymal_Json = YAML.parse(a);
    res.send(Ymal_Json);
})

app.post('/select_cloud_disk_info', urlencodedParser, function(req, res) {
    var size = shell.exec('sh select_disk.sh size ' + req.body.disk + '');
    var used = shell.exec('sh select_disk.sh used ' + req.body.disk + '');
    var avail = shell.exec('sh select_disk.sh avail ' + req.body.disk + '');
    var use = shell.exec('sh select_disk.sh use ' + req.body.disk + '');
    var data = { disk_name: req.body.disk, state: req.body.state, size: size, used: used, avail: avail, use: use };

    res.send(JSON.stringify(data));
})

app.post('/select_state', urlencodedParser, function(req, res) {
    let json = [];
    var server_info = shell.exec('sudo -b lxc query -X GET --wait /1.0/instances/' + req.body.vps + '/state').stdout;
    var server_cpu = shell.exec(`sudo -b lxc exec ${req.body.vps} -- top -n 1 -b |  sed -e 's/ //g' | grep "Cpu(s):" | awk -F ":" '{print $2}' | awk -F "," '{print $4}' | awk -F "%" '{print $1}'`).stdout;
    json.push(server_info, server_cpu);
    res.send(json);
})

app.post('/exec_command', urlencodedParser, function(req, res) {
    console.log(req);
    var exec_command = shell.exec('sudo -b lxc exec ' + req.body.vps + ' -- ' + req.body.command + '').stdout;

    res.send(exec_command);
})

app.post('/reset_server_pass', urlencodedParser, function(req, res) {
    console.log(req);
    var pwd = shell.exec('sudo -b echo -e `pwd`').stdout;
    var push_file = shell.exec('sudo -b lxc file push /www/wwwroot/cvs_node/passwd.sh ' + req.body.vps + '/root/').stdout;
    var reset_pass = shell.exec('sudo -b lxc exec ' + req.body.vps + ' -- sh /root/passwd.sh ' + req.body.server_pass + '').stdout;

    var reset_pass_json = JSON.parse(JSON.stringify(reset_pass).toString());

    res.send(reset_pass_json);
})

app.post('/create_snapshot', urlencodedParser, function(req, res) {
    console.log(req);
    var create_snapshot = shell.exec('sudo -b lxc snapshot ' + req.body.vps + ' ' + req.body.snapshot_name + '').stdout;
    var select_snapshot = shell.exec('sudo -b lxc query -X GET --wait /1.0/instances/' + req.body.vps + '/snapshots/' + req.body.snapshot_name + '').stdout;

    var snapshot_json = JSON.parse(JSON.stringify(select_snapshot).toString());

    res.send(snapshot_json);
})

app.post('/roll_back_snapshot', urlencodedParser, function(req, res) {
    console.log(req);
    var back_snapshot = shell.exec('sudo -b lxc restore ' + req.body.vps + ' ' + req.body.snapshot_name + '');

    var snapshot_json = JSON.parse(JSON.stringify(back_snapshot).toString());

    res.send(snapshot_json);
})

app.post('/delete_roll_back_snapshot', urlencodedParser, function(req, res) {
    console.log(req);
    var delete_back_snapshot = shell.exec('sudo -b lxc delete ' + req.body.vps + '/' + req.body.snapshot_name + '');

    var snapshot_json = JSON.parse(JSON.stringify(delete_back_snapshot).toString());

    res.send(snapshot_json);
})

app.post('/mount_disk', urlencodedParser, function(req, res) {
    var loop = shell.exec('sh select_loop.sh ' + req.body.disk + '').stdout;
    var mount = shell.exec('mount ' + loop + ' /cloudisk/' + req.body.disk + '/').stdout;
    var server_info = shell.exec('sudo -b lxc config device add ' + req.body.vps + ' ' + req.body.disk + ' disk path=/data_' + Math.floor((Math.random() * 10000) + 1) + ' source=/cloudisk/' + req.body.disk + '/data/').stdout;
    console.log(shell.exec('sudo -b lxc config device set ' + req.body.vps + ' ' + req.body.disk + ' limits.read ' + req.body.iops + 'iops'));
    console.log(shell.exec('sudo -b lxc config device set ' + req.body.vps + ' ' + req.body.disk + ' limits.write ' + req.body.iops + 'iops'));

    res.send(server_info);
})

app.post('/umount_disk', urlencodedParser, function(req, res) {
    var server_info = shell.exec('sudo -b lxc config device remove ' + req.body.vps + ' ' + req.body.disk + '').stdout;

    res.send(server_info);
})

app.post('/control_state', urlencodedParser, function(req, res) {
    console.log(req);
    if (req.body.command == 'failure') {
        var command = shell.exec('sudo -b echo -e `lxc stop ' + req.body.vps + ' --force`').stdout;
    } else {
        var command = shell.exec('sudo -b echo -e `lxc ' + req.body.command + ' ' + req.body.vps + '`').stdout;
    }

    res.send(command);
})

app.get('/shell', function(req, res) {
    console.log(req);
    var a = shell.exec(req.query.shell).stdout;
    res.end(a);
})

app.get('/create_server', function(req, res) {
    console.log('123');
    var connection = mysql.createConnection({
        host: Config.configure('mysql_server'),
        user: Config.configure('mysql_user'),
        password: Config.configure('mysql_password'),
        port: Config.configure('mysql_port'),
        database: Config.configure('mysql_database')
    });

    connection.connect();

    var sql = 'SELECT * FROM task_queue';

    //查
    connection.query(sql, function(err, result) {

        var json = JSON.stringify(result[0]);
        var config = new String(result[0].config);
        var json_data = JSON.parse(JSON.stringify(result).toString());
        for (i = 0; i < json_data.length; i++) {
            if (json_data[i].state == '未完成' && json_data[i].type == '云服务器创建' && json_data[i].identification == Config.configure('area')) {
                var foreach_config = new String(json_data[i].config);
                var disk_rand_name = JSON.parse(foreach_config.toString()).disk_config.system_disk.disk_rand_name;
                var disk_system = JSON.parse(foreach_config.toString()).disk_config.data_disk;
                var disk_system_size = disk_system[disk_system.length - 1].value_disk;
                var disk_system_iops = disk_system[disk_system.length - 1].iops;
                console.log(shell.exec('sudo -b lxc storage create system_disk_' + disk_rand_name + ' btrfs'));
                console.log(shell.exec('sudo -b mkdir /cloudisk/system_disk_' + disk_rand_name + ''));
                var loop = shell.exec('sh select_loop.sh system_disk_' + disk_rand_name + '');
                console.log(shell.exec('sudo -b mount ' + loop + ' ' + '/cloudisk/system_disk_' + disk_rand_name + ''));
                var img = shell.exec('lxc storage show system_disk_' + disk_rand_name + '').stdout;
                var Ymal_Json = YAML.parse(img);
                var updata_disk_size = disk_system_size - Ymal_Json.config.size.split('GiB')[0];
                console.log(shell.exec('sudo -b truncate -s +' + updata_disk_size + 'G ' + Ymal_Json.config.source + ''));
                console.log(shell.exec('sudo -b losetup -c ' + loop + ''));
                console.log(shell.exec('sudo -b btrfs fi resize +' + updata_disk_size + 'G /cloudisk/system_disk_' + disk_rand_name + ''));

                var cpu = JSON.parse(foreach_config.toString()).server_config.vcpu.split('核')[0];
                var ram = JSON.parse(foreach_config.toString()).server_config.ram.split(' Gb')[0];
                var server_name = JSON.parse(foreach_config.toString()).server_config.server_name;
                var server_rand_name = JSON.parse(foreach_config.toString()).server_config.server_rand_name;
                var images_server = JSON.parse(foreach_config.toString()).server_config.images_server;
                var images_name = JSON.parse(foreach_config.toString()).server_config.images_name;
                var broadband_peak = JSON.parse(foreach_config.toString()).network_config.network_public.broadband_peak;
                var config_info = new String(json_data[i].config);


                var name = JSON.parse(foreach_config.toString()).server_config.server_name + '_' + JSON.parse(foreach_config.toString()).disk_config.system_disk.disk_rand_name;
                var disk_system_type = disk_system[disk_system.length - 1].value;
                var storage_name = 'system_disk_' + disk_rand_name;
                var vps_name = JSON.parse(foreach_config.toString()).server_config.server_name + '_' + JSON.parse(foreach_config.toString()).server_config.server_rand_name;
                var area = JSON.parse(foreach_config.toString()).info.area;
                var lsdl = JSON.parse(foreach_config.toString()).info.user;
                var time = JSON.parse(foreach_config.toString()).server_config.month;
                var region_b = JSON.parse(foreach_config.toString()).info.region;

                console.log(shell.exec('sudo -b lxc launch ' + images_server + ':' + images_name + ' ' + server_rand_name + ' -t c' + cpu + '-m' + ram + ' -s ' + 'system_disk_' + disk_rand_name + ''));
                console.log(shell.exec('sudo -b lxc config device set ' + server_rand_name + ' root limits.read ' + disk_system_iops + 'iops'));
                console.log(shell.exec('sudo -b lxc config device set ' + server_rand_name + ' root limits.write ' + disk_system_iops + 'iops'));
                console.log(shell.exec('sudo -b lxc config device set ' + server_rand_name + ' eth0 limits.max=' + broadband_peak + 'Mbit'));
                console.log(create_system_disk(name, storage_name, disk_system_iops, disk_system_type, area, disk_system_size, lsdl, time, vps_name, region_b));
                console.log(updata_state(json_data[i].id));
                setTimeout(function() {
                    var network_info = shell.exec('sudo -b lxc info ' + server_rand_name + '').stdout;
                    var Network_Ymal_Json = YAML.parse(network_info);
                    console.log(create_server(config_info, disk_system[disk_system.length - 1], 'system_disk_' + disk_rand_name, Network_Ymal_Json.Resources["Network usage"]["eth0"]["IP addresses"]["inet"]), 'Create_Server');
                }, 9000);

            } else if (json_data[i].state == '未完成' && json_data[i].type == '云硬盘创建' && json_data[i].identification == Config.configure('area')) {
                var foreach_config = new String(json_data[i].config);
                var disk = JSON.parse(foreach_config.toString()).disk_config.data_disk;
                var disk_rand_name = JSON.parse(foreach_config.toString()).disk_config.system_disk.disk_rand_name;
                for (ia = 0; ia < disk.length; ia++) {
                    console.log(shell.exec('sudo -b lxc storage create disk_' + disk_rand_name + '_' + disk[ia].key + ' btrfs'));
                    console.log(shell.exec('sudo -b mkdir /cloudisk/disk_' + disk_rand_name + '_' + disk[ia].key + ''));
                    var loop = shell.exec('sh select_loop.sh disk_' + disk_rand_name + '_' + disk[ia].key + '');
                    console.log(shell.exec('sudo -b mount ' + loop + ' ' + '/cloudisk/disk_' + disk_rand_name + '_' + disk[ia].key + ''));
                    console.log(shell.exec('sudo -b mkdir /cloudisk/disk_' + disk_rand_name + '_' + disk[ia].key + '/data'));
                    console.log(shell.exec('sudo -b chmod -R 777 /cloudisk/disk_' + disk_rand_name + '_' + disk[ia].key + '/'));

                    var img = shell.exec('lxc storage show disk_' + disk_rand_name + '_' + disk[ia].key + '').stdout;
                    var Ymal_Json = YAML.parse(img);
                    var updata_disk_size = disk[ia].value_disk - Ymal_Json.config.size.split('GB')[0];
                    console.log(shell.exec('sudo -b truncate -s +' + updata_disk_size + 'G ' + Ymal_Json.config.source + ''));
                    console.log(shell.exec('sudo -b losetup -c ' + loop + ''));
                    console.log(shell.exec('sudo -b btrfs fi resize +' + updata_disk_size + 'G /cloudisk/disk_' + disk_rand_name + '_' + disk[ia].key + ''));

                    var name = JSON.parse(foreach_config.toString()).server_config.server_name + '_' + JSON.parse(foreach_config.toString()).disk_config.system_disk.disk_rand_name + '_' + ia;
                    var storage_name = 'disk_' + disk_rand_name + '_' + disk[ia].key;
                    var iops = disk[ia].iops;
                    var type = disk[ia].value;
                    var area = JSON.parse(foreach_config.toString()).info.area;
                    var size = disk[ia].value_disk;
                    var lsdl = JSON.parse(foreach_config.toString()).info.user;
                    var region_a = JSON.parse(foreach_config.toString()).info.region;
                    var time = JSON.parse(foreach_config.toString()).server_config.month;
                    console.log(updata_state(json_data[i].id));
                    console.log(create_disk(name, storage_name, iops, type, area, size, lsdl, time, region_a));
                }
            } else {
                console.log(json_data);
            }

        }
        //console.log(err);
    });

    /**
     * 创建云服务器 - 数据库
     * [String] Name {云硬盘名称}
     * [String] Storage_name {存储块名称}
     **/
    function create_server(foreach, disk_info, storage_name, private_ip) {
        var config_info = JSON.parse(foreach.toString());
        var name = config_info.server_config.server_name + '_' + config_info.server_config.server_rand_name;
        var pass = config_info.server_config.server_pass;
        var ordernum = config_info.info.ordernum;
        var area = config_info.info.area;
        var specifications = config_info.server_config.specifications;
        var vcpu = config_info.server_config.vcpu;
        var band = config_info.network_config.network_public.broadband_peak + 'Mbps';
        var img_version = config_info.server_config.server_img_version;
        var img = config_info.server_config.server_img;
        var ram = config_info.server_config.ram;
        var month = config_info.server_config.month;
        var user = config_info.info.user;
        var region = config_info.info.region;
        var disk_type = disk_info.value;
        var container_name = config_info.server_config.server_rand_name;
        var disk_size = disk_info.value_disk + 'Gib';
        // console.log('------------------------',config_info.server_config,'-----------------------------');
        var addSql_c = 'INSERT INTO vps(uid,vps_name,vps_pass,disk_type,disk_size,storage_name,ordernum,area,type,specifications,vcpu,broadband_peak,server_img_version,server_img,private_ip,ram,time,state,lsdl,container_name,region) VALUES(NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
        var addSqlParams_f = [name, pass, disk_type, disk_size, storage_name, ordernum, area, '云服务器', specifications, vcpu, band, img_version, img, private_ip, ram, month, '运行中', user, container_name, region];
        //增
        connection.query(addSql_c, addSqlParams_f, function(err, result) {
            if (err) {
                return '[UPDATE ERROR] - ', err;

            }
            return result, '[Server_Mysql_Create_Success]';
        });
    }

    /**
     * 创建云硬盘 - 数据库
     * [String] Name {云硬盘名称}
     * [String] Storage_name {存储块名称}
     **/
    function create_system_disk(name, storage_name, iops, type, area, size, lsdl, time, vps_name, region_b) {
        var addSql_a = 'INSERT INTO disk(id,name,storage_name,iops,attribute,type,area,region,size,associated_instance,lsdl,time,state) VALUES(NULL,?,?,?,?,?,?,?,?,?,?,?,?)';
        var addSqlParams_b = [name, storage_name, iops, '系统盘', type, area, region_b, size, vps_name, lsdl, time, '已挂载'];
        //增
        connection.query(addSql_a, addSqlParams_b, function(err, result) {
            if (err) {
                return '[UPDATE ERROR] - ', err;

            }
            console.log('create_system_disk-', name, storage_name, iops, type, area, size, lsdl, time, vps_name);
            return result;
        });
    }

    /**
     * 创建云硬盘 - 数据库
     * [String] Name {云硬盘名称}
     * [String] Storage_name {存储块名称}
     **/
    function create_disk(name, storage_name, iops, type, area, size, lsdl, time, region_a) {
        var addSql = 'INSERT INTO disk(id,name,storage_name,iops,attribute,type,area,region,size,associated_instance,lsdl,time,state) VALUES(NULL,?,?,?,?,?,?,?,?,?,?,?,?)';
        var addSqlParams = [name, storage_name, iops, '数据盘', type, area, region_a, size, '未关联', lsdl, time, '待挂载'];
        //增
        connection.query(addSql, addSqlParams, function(err, result) {
            if (err) {
                return '[UPDATE ERROR] - ', err.message;

            }
            return result;
        });
    }

    //更新数据状态
    function updata_state(value) {
        var modSql = 'UPDATE task_queue SET state = ? WHERE id = ?';
        var modSqlParams = ['已完成', value];

        connection.query(modSql, modSqlParams, function(err, result) {
            if (err) {
                return '[UPDATE ERROR] - ', err.message;

            }
            return result.changedRows;
        });
    }

})

//更新母鸡使用率
app.get('/update_server', function(req, res) {

    var connection = mysql.createConnection({
        host: Config.configure('mysql_server'),
        user: Config.configure('mysql_user'),
        password: Config.configure('mysql_password'),
        port: Config.configure('mysql_port'),
        database: Config.configure('mysql_database')
    });

    connection.connect();

    var sql = 'SELECT * FROM server WHERE jiqun="云服务器集群"';

    //查
    connection.query(sql, function(err, result) {
        if (err) {
            console.log('[SELECT ERROR] - ', err.message);
            return;
        }
        var json = JSON.stringify(result[0]);
        var config = new String(result[0].config);
        var config_data = JSON.parse(config.toString());
        var c = config_data['config']['local'][Config.configure('region')];
        var cpu = shell.exec('sh cpu_rate.sh cpu');
        var ram = shell.exec('sh cpu_rate.sh ram');
        var disk = shell.exec('sh cpu_rate.sh disk');
        var load = shell.exec('sh cpu_rate.sh load');
        var dt = new Date();
        var time = dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate() + " " + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();

        for (i = 0; i < c.length; i++) {
            if (c[i]['identification'] == Config.configure('identification')) {
                c[i].cpu_rate = cpu;
                c[i].ram_rate = ram;
                c[i].disk_rate = disk;
                c[i].load_rate = load;
                c[i].up_time = time;
            }
        }

        //res.send(config_data);
        res.send(updata_json(config_data));
    });
    //更新数据
    function updata_json(value) {
        var modSql = 'UPDATE server SET config = ? WHERE jiqun = ?';
        var modSqlParams = [JSON.stringify(value), '云服务器集群'];

        connection.query(modSql, modSqlParams, function(err, result) {
            if (err) {
                return '[UPDATE ERROR] - ', err.message;

            }
            return result.affectedRows;
        });
    }
})
var server = app.listen(2010, function() {

    var host = server.address().address
    var port = server.address().port

    console.log("CVS云计算被控端已开启")

})

setInterval(function() {
    var connection = mysql.createConnection({
        host: Config.configure('mysql_server'),
        user: Config.configure('mysql_user'),
        password: Config.configure('mysql_password'),
        port: Config.configure('mysql_port'),
        database: Config.configure('mysql_database')
    });

    connection.connect();

    var sql = 'SELECT * FROM vps';

    //查
    connection.query(sql, function(err, result) {
        var json_data = JSON.parse(JSON.stringify(result).toString());
        for (i = 0; i < json_data.length; i++) {
            if (json_data[i].state != '已暂停' && json_data[i].state != '已到期') {
                var server_info = JSON.parse(new String(shell.exec('sudo -b lxc query -X GET --wait /1.0/instances/' + json_data[i].container_name + '/state').stdout.toString()));
                vps_state = server_info.status == 'Running' ? '运行中' : '已关机';
                if (server_info.status == "Running") {
                    const send_network_record = Math.abs(server_info.network["eth0"].counters.bytes_sent); //当前容器上行宽带值
                    const received_network_record = Math.abs(server_info.network["eth0"].counters.bytes_received); //当前容器下行宽带值
                    console.log(json_data[i].vps_name, '---------------------------------------------------------------------');
                    let dt = new Date();
                    let time = dt.getFullYear() + "-" + (dt.getMonth() + 1) + "-" + dt.getDate() + " " + dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds();
                    select_record(json_data[i].vps_name, (back) => {
                        let send_new_data = JSON.parse(new String(back.send.toString()));
                        if (send_new_data.last_reocrd == 'null') {
                            send_new_data.last_reocrd = send_network_record;
                            send_new_data.up_time = time;
                            send_new_data.echarts_data.push(0);
                            send_new_data.echarts_time_data.push(time);
                            back.send_total = (~~back.send_total + 0);
                        } else {
                            let now_echarts = Math.abs(send_network_record - send_new_data.last_reocrd); //上次的宽带统计 - 当前宽带 = 使用了多少
                            send_new_data.last_reocrd = send_network_record;
                            send_new_data.echarts_data.push(now_echarts);
                            send_new_data.up_time = time;
                            send_new_data.echarts_time_data.push(time);
                            back.send_total = (~~back.send_total + now_echarts);
                        }

                        let receive_new_data = JSON.parse(new String(back.receive.toString()));
                        if (receive_new_data.last_reocrd == 'null') {
                            receive_new_data.last_reocrd = received_network_record;
                            receive_new_data.up_time = time;
                            receive_new_data.echarts_data.push(0);
                            receive_new_data.echarts_time_data.push(time);
                            back.receive_total = (~~back.receive_total + 0);
                        } else {
                            let snow_echarts = Math.abs(received_network_record - receive_new_data.last_reocrd); //上次的宽带统计 - 当前宽带 = 使用了多少
                            receive_new_data.last_reocrd = received_network_record;
                            receive_new_data.echarts_data.push(snow_echarts);
                            receive_new_data.up_time = time;
                            receive_new_data.echarts_time_data.push(time);
                            back.receive_total = (~~back.receive_total + snow_echarts);
                        }
                        back.send = send_new_data;
                        back.receive = receive_new_data;
                        // console.log(back);
                        updata_record(back, (echo) => {
                            // console.log(echo);
                            connection.end();
                            // res.send('ok');
                        });
                    });

                }
                updata_state(json_data[i].vps_name, vps_state);
                // connection.end();
                // updata_record(json_data[i].vps_name,vps_state);
                // console.log(vps_state);
            } else {
                // console.log(json_data);
            }

        }
        //console.log(err);
    });

    function select_record(vps_name, echo) {
        var sqls = `SELECT * FROM record_network WhERE name = "${vps_name}"`;
        connection.query(sqls, function(err, result) {
            if (err) {
                return '[UPDATE ERROR] - ', err.message;

            }
            echo(JSON.parse(JSON.stringify(result).toString())[0]);
        });
    }

    //更新VPS运行状态
    function updata_state(value, state) {
        var modSql = 'UPDATE vps SET state = ? WHERE vps_name = ?';
        var modSqlParams = [state, value];

        connection.query(modSql, modSqlParams, function(err, result) {
            if (err) {
                return '[UPDATE ERROR] - ', err.message;

            }
            return result.changedRows;
        });
    }

    function updata_record(datas, back) {
        let json_d = JSON.stringify(datas.send).toString();
        let json_s = JSON.stringify(datas.receive).toString();
        var modSql = 'UPDATE record_network SET send = ?, send_total = ?, receive = ?, receive_total = ? WHERE name = ?';
        var modSqlParams = [json_d, datas.send_total, json_s, datas.receive_total, datas.name];

        connection.query(modSql, modSqlParams, function(err, result) {
            if (err) {
                back('[UPDATE ERROR] - ', err, result);

            }
            back(result);
        });
    }

}, 2000);
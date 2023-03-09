exports.configure = function(type) {
    if(type == 'region'){
         return '佛山';   
    }else if(type == 'identification'){
        return 'fs_1';
    }else if(type == 'area'){
        return '佛山一区';
    }else if(type == 'mysql_server'){
        return '192.168.1.9';
    }else if(type == 'mysql_user'){
        return 'cloud';
    }else if(type == 'mysql_password'){
        return 'Jianzhi@123';
    }else if(type == 'mysql_port'){
        return '3306';
    }else if(type == 'mysql_database'){
        return 'cloud';
    }
}
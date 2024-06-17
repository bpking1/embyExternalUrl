#! /bin/bash
script_dir=$(
    cd $(dirname $0)
    pwd
)
sudo rm -rf /etc/nginx/emby2alist
sudo cp -r $script_dir/nginx/conf.d /etc/nginx/emby2alist/
sudo mv /etc/nginx/emby2alist/emby.conf /etc/nginx/conf.d/
sudo rm -rf /etc/nginx/conf.d/includes
sudo mv /etc/nginx/emby2alist/includes /etc/nginx/conf.d/

read -p "请输入AlistAPI" api
if [ ! -n "$api" ]; then
    echo "不替换AlistAPI"
else
    echo 输入的Alist_API是：$api
    sudo sed -i "s/alsit-123456/$api/" /etc/nginx/emby2alist/config/constant-mount.js
fi
read -p "请输入EmbyAPI" api
if [ ! -n "$api" ]; then
    echo "不替换EmbyAPI"
else
    echo 输入的Emby_API是：$api
    sudo sed -i "s/f839390f50a648fd92108bc11ca6730a/$api/" /etc/nginx/emby2alist/config/constant.js
fi

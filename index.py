# -*- coding: utf-8 -*-
"""
本地启动器
------------------------------------------------------------
双击运行后：
  1. 在当前文件夹启动一个本地 HTTP 服务（这个黑窗口就是后台，关掉它服务就停）
  2. 自动用默认浏览器打开本文件夹下的 index.html

为什么要起本地服务而不是直接打开 index.html：
  游戏里用到的 cocos-js / assets 等资源，用 file:// 方式打开常因浏览器
  安全限制（CORS / 模块加载）加载失败，必须通过 http:// 访问才正常。
"""

import os
import sys
import socket
import threading
import webbrowser
import http.server
import socketserver

# 切换到脚本所在目录，保证服务的根目录就是本文件夹
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

PORT = 8000


def find_free_port(start_port):
    """从 start_port 开始找一个没被占用的端口。"""
    port = start_port
    while port < start_port + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port  # 连不上 = 端口空闲
        port += 1
    return start_port


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # 在黑窗口里打印简洁的访问日志
        sys.stdout.write("[访问] %s\n" % (fmt % args))
        sys.stdout.flush()


def main():
    port = find_free_port(PORT)
    url = "http://127.0.0.1:%d/index.html" % port

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), Handler)

    print("=" * 50)
    print(" 本地服务已启动")
    print(" 地址: " + url)
    print(" 根目录: " + ROOT)
    print(" 关闭此窗口即可停止服务")
    print("=" * 50)

    # 延迟一点再开浏览器，确保服务已经在监听
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        print("服务已停止。")


if __name__ == "__main__":
    main()

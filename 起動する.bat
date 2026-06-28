@echo off
cd /d "%~dp0"
powershell -Command "Start-Process 'http://localhost:8080'; python server.py"

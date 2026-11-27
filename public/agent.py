#!/usr/bin/env python3
"""NoVA Pulse - agent chay tren PC Windows.
Gui CPU/RAM/GPU/nhiet do len server moi giay, nhan va thuc thi lenh (chi lenh trong danh sach cho phep)."""
import argparse, ctypes, json, os, shutil, socket, subprocess, sys, threading, time
import urllib.error, urllib.request, webbrowser
import psutil

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CFG_DIR = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "NovaPulse")
CFG_FILE = os.path.join(CFG_DIR, "config.json")
NOWIN = 0x08000000 if os.name == "nt" else 0  # an cua so console cua tien trinh con

VK = {"pp": 0xB3, "next": 0xB0, "prev": 0xB1, "volup": 0xAF, "voldown": 0xAE, "mute": 0xAD}
APPS = {  # (giao thuc app Windows, link du phong)
    "copilot": ("ms-copilot:", "https://copilot.microsoft.com"),
    "chatgpt": (None, "https://chatgpt.com"),
    "gemini": (None, "https://gemini.google.com"),
    "claude": (None, "https://claude.ai"),
}

PS_TEMP = r"""
$t=$null
try{$s=Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -ErrorAction Stop|?{$_.SensorType -eq 'Temperature' -and $_.Name -like '*CPU*'};if($s){$t=($s|Measure-Object Value -Maximum).Maximum}}catch{}
if($t -eq $null){try{$z=Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop|Select-Object -First 1;if($z){$t=$z.CurrentTemperature/10-273.15}}catch{}}
if($t -ne $null){[math]::Round($t,1)}
"""

cfg = {}
cpu_temp = {"v": None}


def load_cfg():
    try:
        with open(CFG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_cfg():
    os.makedirs(CFG_DIR, exist_ok=True)
    with open(CFG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f)


def call(path, body=None, token=None):
    req = urllib.request.Request(
        cfg["server"] + path,
        data=json.dumps(body or {}).encode(),
        method="POST",
        headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if token else {})},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def register():
    d = call("/api/pair?action=register", {"name": socket.gethostname()})
    cfg.update(agentToken=d["agentToken"], deviceId=d["deviceId"])
    save_cfg()


def show_pin():
    d = call("/api/pair?action=pin", token=cfg["agentToken"])
    print("\n  ==============================")
    print("   NoVA Pulse - MA PIN:  %s" % d["pin"])
    print("   (dung 1 lan, het han sau %d phut)" % (d["ttl"] // 60))
    print("  ==============================\n", flush=True)


def gpu_stats():
    if not shutil.which("nvidia-smi"):
        return None, None
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5, creationflags=NOWIN,
        ).stdout.strip().splitlines()[0]
        u, t = [float(x) for x in out.split(",")]
        return u, t
    except Exception:
        return None, None


def temp_worker():  # doc nhiet do CPU moi 15 giay (PowerShell khoi dong cham nen khong goi moi giay)
    while True:
        try:
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command", PS_TEMP],
                capture_output=True, text=True, timeout=20, creationflags=NOWIN,
            ).stdout.strip()
            cpu_temp["v"] = float(out) if out else None
        except Exception:
            cpu_temp["v"] = None
        time.sleep(15)


def stats():
    g_util, g_temp = gpu_stats()
    return {
        "cpu": psutil.cpu_percent(None),
        "ram": psutil.virtual_memory().percent,
        "gpu": g_util,
        "tmp": cpu_temp["v"] if cpu_temp["v"] is not None else g_temp,
    }


def press(vk):
    u = ctypes.windll.user32
    u.keybd_event(vk, 0, 0, 0)
    u.keybd_event(vk, 0, 2, 0)


def open_app(name):
    proto, url = APPS[name]
    if proto:
        try:
            os.startfile(proto)
            return
        except Exception:
            pass
    webbrowser.open(url)


def handle(c):  # chi chap nhan lenh trong danh sach cho phep, khong bao gio chay lenh shell tu xa
    try:
        if c.get("type") == "media" and c.get("action") in VK:
            press(VK[c["action"]])
        elif c.get("type") == "open" and c.get("app") in APPS:
            open_app(c["app"])
    except Exception as e:
        print("Loi lenh:", e)


def main():
    global cfg
    ap = argparse.ArgumentParser()
    ap.add_argument("--server")
    ap.add_argument("--pin", action="store_true", help="hien ma PIN roi tiep tuc chay")
    ap.add_argument("--pin-only", action="store_true", help="chi hien ma PIN roi thoat")
    a = ap.parse_args()
    cfg = load_cfg()
    if a.server:
        cfg["server"] = a.server.rstrip("/")
    if not cfg.get("server"):
        sys.exit("Thieu --server")
    save_cfg()
    if not cfg.get("agentToken"):
        register()
    if a.pin or a.pin_only:
        show_pin()
    if a.pin_only:
        return

    psutil.cpu_percent(None)  # lan goi dau luon tra 0
    threading.Thread(target=temp_worker, daemon=True).start()
    wait = 1
    while True:
        t0 = time.time()
        try:
            res = call("/api/agent", {"stats": stats()}, cfg["agentToken"])
            for c in res.get("cmds", []):
                handle(c)
            wait = 1
        except urllib.error.HTTPError as e:
            if e.code == 401:  # server da xoa token -> dang ky lai
                register()
            wait = min(wait * 2, 30)
        except Exception:
            wait = min(wait * 2, 30)
        time.sleep(max(0.0, wait - (time.time() - t0)))


if __name__ == "__main__":
    main()

# NoVA Pulse – server + agent PC

## Triển khai (một lần)
1. Đưa thư mục này lên GitHub, rồi Vercel → Add New → Project → Import (Framework: Other).
2. Vercel → Storage → tạo **Upstash Redis** (Marketplace) và nối vào project. Vercel tự thêm biến môi trường `KV_REST_API_URL` / `KV_REST_API_TOKEN` (hoặc `UPSTASH_REDIS_REST_*`).
3. Deploy. Mở `https://<tên-app>.vercel.app` trên điện thoại (Chrome → Thêm vào màn hình chính = PWA).

## Cài agent trên PC (PowerShell)
    irm https://<tên-app>.vercel.app/install.ps1 | iex
Cửa sổ sẽ hiện mã PIN 6 số → nhập vào app trên điện thoại. Lần sau xin PIN mới (thêm điện thoại khác): chạy `%LOCALAPPDATA%\NovaPulse\pin.cmd`.

## Luồng hoạt động
PC đăng ký → xin PIN (6 số, dùng 1 lần, 10 phút) → điện thoại gửi PIN → nhận session token 30 ngày.
Mỗi giây agent đẩy CPU/RAM/GPU/nhiệt độ và nhận lệnh; điện thoại đọc số liệu mỗi 1,5 giây.

## Bảo mật đã có
- PIN dùng 1 lần, giới hạn 10 lần thử / 10 phút / IP.
- Lệnh từ điện thoại chỉ gồm danh sách cố định (phím media, mở copilot/chatgpt/gemini/claude); server và agent đều kiểm tra, không chạy lệnh shell tuỳ ý.

## Nhiệt độ CPU
Windows không cung cấp nhiệt độ CPU ổn định. Muốn có số chính xác, cài LibreHardwareMonitor và bật Remote Web Server/WMI; nếu không có, agent dùng nhiệt độ GPU NVIDIA.

# Follow kĩ theo từng step để tránh lỗi

## 1. Yêu cầu môi trường

- Mở terminal của windows
- Kiểm tra xem đã cài Ubuntu chưa:

```bash
wsl --list --verbose
```

- Nếu chưa:

```bash
wsl --install -d Ubuntu
```

## 2. Setup docker engine

- Trong terminal của windows, nhập `wsl` để truy cập vào ubuntu và chạy lần lượt các lệnh bên dưới:

[https://docs.docker.com/engine/install/ubuntu/] Tham khảo từ trang chủ của docker engine

```bash
# Add Docker's official GPG key:
# chạy từng lệnh
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
## Copy nguyên cụm
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF ## Copy nguyên cụm

sudo apt update

```

- Install docker packages:

```bash
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# The Docker service starts automatically after installation. To verify that Docker is running, use:
sudo systemctl status docker
# Verify that the installation is successful by running the hello-world image:
sudo docker run hello-world
```

## 3. Setup redis

- Mở root của project

```bash
# cấp quyền để chạy docker không cần sudo (bắt buộc)
sudo usermod -aG docker $USER
# Thoát ubuntu
exit
wsl --shutdown
# Bật lại unbutu và kiểm tra
wsl
groups
## pull image và chạy redis (chạy bằng wsl)
docker compose up -d redis
## test thử, trả về PONG là ok
docker exec -it cinebook-redis redis-cli ping
```

## 4. Chạy Celery

- Celery cần hạ tầng của redis nên vui lòng ok ở bước redis
- Nhớ cập nhật .env theo .env.example

```bash
uv add celery
uv add redis # client để celery giao tiếp
uv sync
# thực tế chỉ cần uv sync vì celery và redis đã được add trước đó
```

- Chạy từng terminal cho từng tiến trình:

```bash
# redis server ở root
wsl
docker compose up -d redis

# backend
cd backend
uv run python manage.py migrate
uv run python manage.py runserver

# celery worker
uv run celery -A config worker -l info --pool=solo
```

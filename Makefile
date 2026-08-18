all: start

start:
	docker compose up -d
restart:
	docker compose restart refringe-api
stop:
	docker compose stop
down:
	docker compose down
remove:
	docker compose down -v
apilogs:
	docker compose logs refringe-api

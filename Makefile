all: start

start:
	docker compose up -d
restart:
	docker compose restart refringe-api
stop:
	docker compose stop
down:
	docker compose down
remove: stop
	docker compose down -v
clean: remove
	rm logs/refringe-logs.sqlite
apilogs:
	docker compose logs refringe-api

.PHONY: build release

BUMP ?= patch

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules

build: node_modules
	npm run build

release:
	@scripts/release.sh $(BUMP)

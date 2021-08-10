#!/usr/bin/env bash

npm run build

# copy source to root dir
cp -r ./src/** .
rm index.js

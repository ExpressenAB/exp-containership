#!/bin/sh -e

git tag -f deployed
git push --force origin deployed

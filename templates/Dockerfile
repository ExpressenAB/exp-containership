# Runs the app as a docker container, to get started on your machine:
# * install boot2docker
# build the container:  docker build -t node-starterapp .
# run the container: docker run -d -i -p 3000:3000 node-starterapp
# To run the container as e dev env, the src directory needs to mounted in container as a volume.
#
FROM exp-docker.repo.dex.nu/nodejs:0.12
MAINTAINER Infra team Expressen <infra@expressen.se>

ENV NODE_ENV=production

ADD . /tmp/app/

RUN cd /tmp/app && npm install && npm test && npm pack && tar xzf *.tgz -C /tmp && \
    mv node_modules /tmp/package && cd /tmp/package && npm prune && mv /tmp/package/* /exp-container/app && \
    rm -rf /tmp/*

EXPOSE 3000

ENTRYPOINT ["/exp-container/start.sh"]

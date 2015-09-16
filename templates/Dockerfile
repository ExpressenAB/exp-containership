FROM exp-docker.repo.dex.nu/nodejs:0.12
MAINTAINER Infra team Expressen <infra@expressen.se>

ENV NODE_ENV=development

ADD . /tmp/app/

RUN cd /tmp/app && npm install && npm pack && tar xzf *.tgz -C /tmp && \
    mv node_modules /tmp/package && cd /tmp/package && NODE_ENV=production npm prune && \
    mv /tmp/package/* /exp-container/app && mv /tmp/package/.[!.]* /exp-container/app && rm -rf /tmp/*

EXPOSE 3000

ENTRYPOINT ["/exp-container/start.sh"]

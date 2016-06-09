FROM exp-docker.repo.dex.nu/nodejs:6
MAINTAINER Infra team Expressen <infra@expressen.se>

ENV NODE_ENV=development

# First add just the package json file and do in-container install
# This way, we only rebuild deps if package.json is changed
ADD package.json /tmp/app/
RUN cd /tmp/app && npm install

# Then add the rest of the package contents and prune out dev deps
ADD . /tmp/app/
RUN cd /tmp/app && npm pack && tar xzf *.tgz -C /tmp && \
        mv node_modules /tmp/package && cd /tmp/package && NODE_ENV=production npm prune && \
        mv /tmp/package/* /exp-container/app && mv /tmp/package/.[!.]* /exp-container/app && rm -rf /tmp/*

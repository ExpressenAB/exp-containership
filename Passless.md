# Passless ssh setup

For a swift and pain-free ssh experience, we recommend that you setup passwordless login using private/public keys.
Feel free to use this script to automate the process

```bash
#!/bin/sh
# Shell script to install your public key on a remote machine
# Takes the remote machine name as an argument.
# Obviously, the remote machine must accept password authentication,
# or one of the other keys in your ssh-agent, for this to work.

ID_FILE="${HOME}/.ssh/id_rsa.pub"
if [ "-i" = "$1" ]; then
  shift
  # check if we have 2 parameters left, if so the first is the new ID file
  if [ -n "$2" ]; then
    if expr "$1" : ".*\.pub" > /dev/null ; then
      ID_FILE="$1"
    else
      ID_FILE="$1.pub"
    fi
    shift # and this should leave $1 as the target name
  fi
else
  if [ x$SSH_AUTH_SOCK != x ] ; then
    GET_ID="$GET_ID ssh-add -L | grep -vxF 'The agent has no identities.'"
  fi
fi
if [ -z "`eval $GET_ID`" ] && [ -r "${ID_FILE}" ] ; then
  GET_ID="cat ${ID_FILE}"
fi
if [ -z "`eval $GET_ID`" ]; then
  echo "$0: ERROR: No identities found" >&2
  exit 1
fi
if [ "$#" -lt 1 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  echo "Usage: $0 [-i [identity_file]] [user@]machine" >&2
  exit 1
fi
{ eval "$GET_ID" ; } | ssh $1 "umask 077; test -d .ssh || mkdir .ssh ; cat >> .ssh/authorized_keys; test -x /sbin/restorecon && /sbin/restorecon .ssh .ssh/authorized_keys" || exit 1
```

## Usage

Save the script locally as "passless.sh" and the use it to enable passwordless login on servers you access.
For example:

```
$ for n in {1..6}; do sh passless.sh "your.username@xpr-p-app10${n}.sth.basefarm.net" ; done
$ for n in {1..2}; do sh passless.sh "your.username@xpr-t-test10${n}.sth.basefarm.net" ; done

```

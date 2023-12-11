FROM node:latest

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Your app binds to port 3000 so you use the EXPOSE instruction to have it mapped by the docker daemon
EXPOSE 3000

CMD ["tail", "-f", "/dev/null"]
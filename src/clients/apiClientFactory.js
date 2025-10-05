// src/clients/apiClientFactory.js
const { BaseAPIClient } = require('./baseApiClient');

class APIClientFactory {
  constructor() {
    this.apiConfigs = {
      'jsonplaceholder-users': {
        name: 'JSONPlaceholder Users',
        url: 'https://jsonplaceholder.typicode.com/users',
        parser: (data) => ({ users: data.slice(0, 3) })
      },
      'jsonplaceholder-posts': {
        name: 'JSONPlaceholder Posts',
        url: 'https://jsonplaceholder.typicode.com/posts',
        parser: (data) => ({ posts: data.slice(0, 5) })
      },
      'jsonplaceholder-comments': {
        name: 'JSONPlaceholder Comments',
        url: 'https://jsonplaceholder.typicode.com/comments',
        parser: (data) => ({ comments: data.slice(0, 5) })
      },
      'jsonplaceholder-albums': {
        name: 'JSONPlaceholder Albums',
        url: 'https://jsonplaceholder.typicode.com/albums',
        parser: (data) => ({ albums: data.slice(0, 3) })
      },
      'jsonplaceholder-photos': {
        name: 'JSONPlaceholder Photos',
        url: 'https://jsonplaceholder.typicode.com/photos',
        parser: (data) => ({ photos: data.slice(0, 3) })
      },
      'jsonplaceholder-todos': {
        name: 'JSONPlaceholder Todos',
        url: 'https://jsonplaceholder.typicode.com/todos',
        parser: (data) => ({ todos: data.slice(0, 5) })
      },
      'cat-facts': {
        name: 'Cat Facts',
        url: 'https://catfact.ninja/fact',
        parser: (data) => ({ catFact: data.fact })
      },
      'dog-facts': {
        name: 'Dog Facts',
        url: 'https://dogapi.dog/api/v2/facts',
        parser: (data) => ({ dogFacts: data.data || [] })
      },
      'random-user': {
        name: 'Random User',
        url: 'https://randomuser.me/api/',
        parser: (data) => ({ randomUser: data.results?.[0] || null })
      },
      'activity-api': {
        name: 'Bored API',
        url: 'https://pokeapi.co/api/v2/pokemon/pikachu',
        parser: (data) => ({ activity: data.activity })
      }
    };
  }

  createClient(type) {
    const config = this.apiConfigs[type];
    
    if (!config) {
      throw new Error(`Unknown API client type: ${type}`);
    }

    return new BaseAPIClient(config);
  }
}

module.exports = { APIClientFactory };
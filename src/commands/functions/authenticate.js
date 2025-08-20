import {
  validateSaveUdacityAuthToken,
} from '.';

const inquirer = require('inquirer');

const SIGNIN_URL = 'https://user-api.udacity.com/signin';

const questions = [
  {
    type: 'input',
    name: 'email',
    message: 'Email:',
  },
  {
    type: 'password',
    name: 'password',
    message: 'Password:',
  },
  {
    type: 'input',
    name: 'otp',
    message: '2FA code (if applicable, else leave blank):',
    default: '',
  },
];

export default async function authenticate() {
  const answers = await inquirer.prompt(questions);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:74.0) Gecko/20100101 Firefox/74.0',
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.5',
    Referer: 'https://auth.udacity.com/sign-in?next=https%3A%2F%2Flearn.udacity.com%2Fauthenticated',
    'Content-Type': 'application/json;charset=UTF-8',
    'X-Udacity-Ads-Are-Blocked': 'unknown',
    Origin: 'https://auth.udacity.com',
  };

  const body = {
    email: answers.email,
    password: answers.password,
    otp: answers.otp || '',
    next: 'https://learn.udacity.com/authenticated',
  };

  try {
    const res = await fetch(SIGNIN_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error(errJson.message || `Sign-in failed with status ${res.status}`);
      return 1;
    }

    const data = await res.json();
    validateSaveUdacityAuthToken(data.jwt);
    return 0;
  } catch (error) {
    console.error(error);
    return 1;
  }
}

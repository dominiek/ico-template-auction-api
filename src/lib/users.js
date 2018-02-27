
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createHash } = require('crypto');
const User = require('../models/user');

const BCRYPT_SALT_ROUNDS = 10;

exports.signup = async ({
  username,
  email,
  password,
  passwordRepeat,
  name,
}) => {
  // Create user object canidate
  const user = new User({
    username, email, name,
  });

  // Check if user is unique
  if (await User.count({ email }) > 0) {
    throw new Error('User with that email already exists');
  }

  // Check if user is unique
  if (await User.count({ username }) > 0) {
    throw new Error('User with that username already exists');
  }

  // Check password and generate hash
  if (!password || !password.length) throw new Error('Expected password to not be blank');
  if (password !== passwordRepeat) throw new Error('Expected passwords to match');
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  user.hash = await bcrypt.hash(password, salt);
  user.role = 'user';

  // Save
  await user.save();

  return user;
};

exports.authenticate = async (email, password) => {
  if (!email) throw new Error('Email cannot be blank');
  if (!password || !password.length) throw new Error('Password cannot be blank');
  const user = await User.findOne({ email });
  if (user) {
    const comparison = await bcrypt.compare(password, user.hash);
    if (comparison === true) {
      return user;
    }
  }
  throw new Error('Incorrect email or password');
};

exports.exportSafeUser = (user) => {
  const object = user.toObject();
  delete object.hash;
  return object;
};

exports.encodeSession = (jwtSecret, userId) => jwt.sign({ userId }, jwtSecret);

exports.decodeSession = (jwtSecret, token) => {
  const payload = jwt.verify(token, jwtSecret);
  if (!payload || !payload.userId) throw new Error('Invalid Token');
  return payload.userId;
};

exports.hasRole = (user, role) => user.role === role;

exports.requireRole = (user, role) => {
  if (!exports.hasRole(user, role)) throw new Error('Permission denied');
};

exports.forgotPassword = async (user) => {
  const hash = createHash('sha256');
  hash.update(`${user.email}-${user.name}-${Date.now()}`);
  const resetPasswordToken = hash.digest('hex');
  user.set({ resetPasswordToken });
  await user.save();
  return resetPasswordToken;
};

exports.setPassword = async (user, newPassword) => {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  const hash = await bcrypt.hash(newPassword, salt);
  user.set({ hash });
  await user.save();
};

exports.resetPassword = async (user, resetPasswordToken, newPassword) => {
  if (!user.resetPasswordToken || user.resetPasswordToken !== resetPasswordToken) {
    throw new Error('Invalid reset password token given, could not reset password');
  }
  await exports.setPassword(user, newPassword);
};

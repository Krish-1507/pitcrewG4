function authorize(user, action) {
  if (!user) throw new Error('unauthorized');
  if (action === 'delete' && user.role !== 'admin')
    throw new Error('forbidden');
  return true;
}

module.exports = { authorize };

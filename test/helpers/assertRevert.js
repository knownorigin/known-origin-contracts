const EVMRevert = 'revert';

module.exports = async (promise, expectedError) => {
  try {
    await promise;
    assert.fail('Expected revert not received');
  } catch (error) {
    if (error.reason && expectedError) {
      console.log("Failure reason", error.reason);
      console.log("expectedError", expectedError);
      assert(error.reason === expectedError, `unexpected revert reason of [${error.reason}]`);
    } else {
      const revertFound = error.message.search(EVMRevert) >= 0;
      assert(revertFound, `Expected "revert", got ${error} instead`);
    }
  }
};

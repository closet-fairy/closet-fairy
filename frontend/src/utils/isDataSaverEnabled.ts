const isDataSaverEnabled = () => {
  if (!('connection' in navigator)) return false;

  const { connection } = navigator;

  return (
    typeof connection === 'object' &&
    connection !== null &&
    'saveData' in connection &&
    connection.saveData === true
  );
};

export default isDataSaverEnabled;

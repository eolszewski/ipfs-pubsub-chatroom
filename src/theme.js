import { createMuiTheme } from '@material-ui/core/styles';
import {
  deepPurple,
  red
} from '@material-ui/core/colors';
import spacing from '@material-ui/core/styles/spacing';

export default createMuiTheme({
  spacing: spacing,

  typography: {
    fontFamily: 'Lato',
  },
  palette: {
    primary: {
      light: deepPurple['700'],
      main: deepPurple['700'],
      dark: deepPurple['900'],
      contrastText: '#fff'
    },
    secondary: {
      light: red['A200'],
      main: red['A400'],
      dark: red['A700'],
      contrastText: '#fff'
    },
    error: red
  }
});

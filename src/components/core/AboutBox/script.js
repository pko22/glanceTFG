import SvgIcon from 'paraview-glance/src/components/widgets/SvgIcon';
import dicomHubLogo from 'paraview-glance/static/icons/dicomhub.png';
// ----------------------------------------------------------------------------

export default {
  name: 'AboutBox',
  components: {
    SvgIcon,
  },
  data() {
    return {
      version: 'not available',
      logo: dicomHubLogo,
    };
  },
  created() {
    if (window.GLANCE_VERSION) {
      if (window.GLANCE_VERSION === 'master') {
        this.version = 'nightly (master)';
      } else {
        this.version = window.GLANCE_VERSION;
      }
    }
  },
};

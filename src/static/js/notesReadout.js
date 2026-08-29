// NotesReadout.js - Vue component for Notes button
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useNotes } from 'useNotes';

export default defineComponent({
    name: 'NotesReadout',
    props: {
        proposalid: {
            type: [Number, String, null],
            default: null
        },
        showid: {
            type: [Number, String, null],
            default: null
        },
        userid: {
            type: [Number, String, null],
            default: null
        },
        venueid: {
            type: [Number, String, null],
            default: null
        },
    },
    setup(props) {
        const { activeNotes, loadNotes, context } = useNotes();
        
        const contextType = computed(() => {
            if (props.proposalid) return 'proposal';
            if (props.showid) return 'show';
            if (props.userid) return 'user';
            if (props.venueid) return 'venue';
            return null;
        });
        
        // Load notes on mount
        onMounted(() => {
            loadNotes(contextType.value, props);
        });

        return {
            activeNotes
        };
    },
    template: `
        <ul>
            <li v-for="note of activeNotes">{{ note.content }}</li>
        </ul>
    `
});
